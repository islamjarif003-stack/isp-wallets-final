import { getServiceDb, getAccountWalletDb } from '../../../config/database';
import { WalletService } from '../../wallet/wallet.service';
import { withLock } from '../../../utils/distributed-lock';
import { generateIdempotencyKey } from '../../../utils/idempotency';
import { logger } from '../../../utils/logger';
import { AppError, NotFoundError, InsufficientBalanceError } from '../../../utils/errors';
import { CreateHotspotCardInput, PurchaseHotspotInput, HotspotCardStats } from './hotspot.types';
import { createAuditLog } from '../../../utils/audit';
import { notifyServicePurchased, notifyServiceCompleted, notifyServiceFailed } from '../../notification/notification.queue';
import { ServiceType } from '@prisma/service-client';

import { getNotificationService } from '../../notification/notification.service';
import bcrypt from 'bcrypt';

export class HotspotService {
  private serviceDb = getServiceDb();
  private walletDb = getAccountWalletDb();
  private walletService = new WalletService();
  private notificationService = getNotificationService();

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Verify Admin Password
  // ═══════════════════════════════════════════════════════════════
  private async verifyAdminPassword(adminId: string, password?: string) {
    if (!password) {
        throw new AppError('Password is required', 400);
    }
    const admin = await this.walletDb.user.findUnique({
        where: { id: adminId }
    });
    if (!admin || !admin.passwordHash) {
        throw new ForbiddenError('Admin authentication failed');
    }
    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) {
        throw new ForbiddenError('Invalid password');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN: CARD MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async addCards(input: CreateHotspotCardInput, adminId: string) {
    const pkg = await this.serviceDb.servicePackage.findUnique({
      where: { id: input.packageId, serviceType: 'HOTSPOT_WIFI' },
    });

    if (!pkg) {
      throw new NotFoundError('Hotspot package not found');
    }

    // Filter duplicates within input
    const uniqueCodes = [...new Set(input.codes)];
    
    // Check existing duplicates in DB
    const existing = await this.serviceDb.hotspotCard.findMany({
      where: {
        code: { in: uniqueCodes }
      },
      select: { code: true }
    });
    
    const existingCodes = new Set(existing.map(c => c.code));
    const newCodes = uniqueCodes.filter(c => !existingCodes.has(c));

    if (newCodes.length === 0) {
      return { count: 0, message: 'All codes already exist' };
    }

    await this.serviceDb.hotspotCard.createMany({
      data: newCodes.map(code => ({
        packageId: input.packageId,
        code,
        status: 'AVAILABLE'
      }))
    });

    logger.info('Hotspot cards added', { 
      packageId: input.packageId, 
      count: newCodes.length, 
      adminId 
    });

    return { 
      count: newCodes.length, 
      duplicates: uniqueCodes.length - newCodes.length 
    };
  }

  async getCardStats(): Promise<HotspotCardStats[]> {
    const packages = await this.serviceDb.servicePackage.findMany({
      where: { serviceType: 'HOTSPOT_WIFI' },
      select: { id: true, name: true }
    });

    const stats: HotspotCardStats[] = [];

    for (const pkg of packages) {
      const [total, available, used] = await Promise.all([
        this.serviceDb.hotspotCard.count({ where: { packageId: pkg.id } }),
        this.serviceDb.hotspotCard.count({ where: { packageId: pkg.id, status: 'AVAILABLE' } }),
        this.serviceDb.hotspotCard.count({ where: { packageId: pkg.id, status: 'USED' } }),
      ]);

      stats.push({
        packageId: pkg.id,
        packageName: pkg.name,
        total,
        available,
        used
      });
    }

    return stats;
  }

  async resetCard(cardId: string, adminId: string): Promise<void> {
    const card = await this.serviceDb.hotspotCard.findUnique({
      where: { id: cardId }
    });

    if (!card) throw new NotFoundError('Card not found');

    if (card.status === 'AVAILABLE') {
      throw new AppError('Card is already available', 400);
    }

    await this.serviceDb.hotspotCard.update({
      where: { id: cardId },
      data: { 
        status: 'AVAILABLE',
        usedBy: null,
        updatedAt: new Date()
      }
    });

    logger.info('Hotspot card reset to AVAILABLE', { cardId, adminId });
  }

  async getUsedCards(packageId?: string): Promise<any[]> {
    const where: any = { status: 'USED' };
    if (packageId) where.packageId = packageId;

    const cards = await this.serviceDb.hotspotCard.findMany({
      where,
      include: {
        package: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100 // Limit to last 100 used cards for now
    });

    return cards;
  }

  async getAvailableCards(packageId?: string): Promise<any[]> {
    const where: any = { status: 'AVAILABLE' };
    if (packageId) where.packageId = packageId;

    const cards = await this.serviceDb.hotspotCard.findMany({
      where,
      include: {
        package: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return cards;
  }

  async updateCard(cardId: string, newCode: string, adminId: string, password?: string): Promise<void> {
    await this.verifyAdminPassword(adminId, password);

    const card = await this.serviceDb.hotspotCard.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundError('Card not found');
    if (card.status !== 'AVAILABLE') throw new AppError('Only available cards can be edited', 400);

    // Check duplicate
    const existing = await this.serviceDb.hotspotCard.findUnique({ where: { code: newCode } });
    if (existing && existing.id !== cardId) {
        throw new ConflictError('Card code already exists');
    }

    await this.serviceDb.hotspotCard.update({
        where: { id: cardId },
        data: { code: newCode }
    });

    logger.info('Card code updated', { cardId, newCode, adminId });
  }

  async deleteCard(cardId: string, adminId: string, password?: string): Promise<void> {
    await this.verifyAdminPassword(adminId, password);

    const card = await this.serviceDb.hotspotCard.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundError('Card not found');

    await this.serviceDb.hotspotCard.delete({ where: { id: cardId } });
    logger.info('Card deleted', { cardId, code: card.code, adminId });
  }

  async deleteAllAvailableCards(packageId: string | undefined, adminId: string, password?: string): Promise<void> {
    await this.verifyAdminPassword(adminId, password);

    const where: any = { status: 'AVAILABLE' };
    if (packageId) where.packageId = packageId;

    const result = await this.serviceDb.hotspotCard.deleteMany({ where });
    logger.info('All available cards deleted', { count: result.count, packageId, adminId });
  }

  async getPackageStock(packageId: string) {
    const available = await this.serviceDb.hotspotCard.count({
      where: { packageId, status: 'AVAILABLE' }
    });
    return { available };
  }

  // ═══════════════════════════════════════════════════════════════
  // USER: PURCHASE
  // ═══════════════════════════════════════════════════════════════

  async purchaseHotspot(input: PurchaseHotspotInput) {
    const lockKey = `hotspot:purchase:${input.userId}`; // Lock user to prevent double click
    
    return withLock(lockKey, async () => {
      // 1. Validate Package
      const pkg = await this.serviceDb.servicePackage.findUnique({
        where: { id: input.packageId, serviceType: 'HOTSPOT_WIFI' },
      });

      if (!pkg) throw new NotFoundError('Package not found');
      if (pkg.status !== 'ACTIVE') throw new AppError('Package is not active', 400);

      // 2. Pre-check Stock (Optimization)
      const availableCount = await this.serviceDb.hotspotCard.count({
        where: { packageId: pkg.id, status: 'AVAILABLE' }
      });

      if (availableCount === 0) {
        throw new AppError('Out of Stock', 400);
      }

      // 3. Create Execution Log (Pending)
      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: 'HOTSPOT_WIFI',
          serviceRecordId: 'PENDING',
          packageId: pkg.id,
          userId: input.userId,
          status: 'PENDING',
          requestPayload: input as any,
          startedAt: new Date(),
        },
      });

      let walletTxId: string | undefined;
      let allocatedCard: any | undefined;

      try {
        // 4. Debit Wallet (Money separation: Wallet DB only)
        const walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: parseFloat(pkg.price.toString()),
          category: 'SERVICE_PURCHASE',
          idempotencyKey: generateIdempotencyKey(),
          description: `Hotspot: ${pkg.name}`,
          referenceId: executionLog.id,
          referenceType: 'HOTSPOT_PURCHASE',
        });
        
        walletTxId = walletTx.transactionId;

        // Update log with transaction ID
        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: { walletTransactionId: walletTxId, status: 'EXECUTING' }
        });

        // 5. Atomic Card Allocation (The Critical Part)
        // We need to find ONE available card and mark it USED atomically.
        // Prisma doesn't support "UPDATE ... LIMIT 1 RETURNING" directly in `updateMany`.
        // We use a transaction with raw query or careful locking.
        // Since we are inside `withLock` (distributed lock on USER), we are safe from same-user race conditions.
        // But multiple users might try to buy same package.
        // We need a DB lock on the card row.
        
        allocatedCard = await this.serviceDb.$transaction(async (tx) => {
          // Find first available card with locking
          // Prisma doesn't support SELECT FOR UPDATE easily. 
          // We will attempt to update one where status is available.
          // Since UUIDs are not sequential, we can't easily pick "first".
          // We will fetch one ID then try to update it.
          
          const candidate = await tx.hotspotCard.findFirst({
            where: { packageId: pkg.id, status: 'AVAILABLE' },
            select: { id: true }
          });
          
          if (!candidate) {
             throw new Error('OUT_OF_STOCK_RACE_CONDITION');
          }
          
          // Try to update this specific card. If it was taken in between, update will fail (count 0).
          // Actually `update` throws if not found? No, `update` throws.
          // `updateMany` returns count.
          
          const updatedBatch = await tx.hotspotCard.updateMany({
            where: { id: candidate.id, status: 'AVAILABLE' },
            data: { 
              status: 'USED',
              usedBy: input.userId, // Store userId temporarily or link to service later?
              // The schema has `usedBy` as uuid.
              updatedAt: new Date()
            }
          });
          
          if (updatedBatch.count === 0) {
             throw new Error('OUT_OF_STOCK_RACE_CONDITION');
          }
          
          return tx.hotspotCard.findUnique({ where: { id: candidate.id } });
        });

        if (!allocatedCard) throw new Error('Failed to allocate card');

        // 6. Create Service Record
        const service = await this.serviceDb.hotspotService.create({
          data: {
            userId: input.userId,
            packageId: pkg.id,
            voucherCode: allocatedCard.code,
            status: 'ACTIVE', // Or whatever OwnershipStatus is appropriate
            walletTransactionId: walletTxId,
            activatedAt: new Date(),
          }
        });

        // 7. Update Card with Service ID? 
        // Schema `usedBy` is UUID. Could be userId (already set) or serviceId.
        // Let's keep it as userId for now as set in step 5.
        
        // 8. Complete Log
        await this.serviceDb.serviceExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: 'COMPLETED',
            serviceRecordId: service.id,
            completedAt: new Date(),
            responsePayload: { voucherCode: allocatedCard.code }
          }
        });

        // 9. Send SMS
        try {
            const smsMessage = `Your Hotspot PIN is ${allocatedCard.code}. Package: ${pkg.name}. Valid for ${pkg.validity} Days. Enjoy!`;
            await this.notificationService.queueSms(input.mobileNumber, smsMessage);
            logger.info(`SMS queued for ${input.mobileNumber}: ${smsMessage}`);
        } catch (smsError: any) {
            logger.error('SMS sending failed', { error: smsError.message });
            // Throw error to trigger refund flow
            throw new Error('Failed to send SMS voucher');
        }
        
        notifyServiceCompleted(input.userId, pkg.name);

        return {
          success: true,
          message: 'Hotspot voucher purchased successfully',
          data: {
            serviceId: service.id,
            voucherCode: allocatedCard.code,
            packageName: pkg.name,
            price: pkg.price
          }
        };

      } catch (error: any) {
        logger.error('Hotspot purchase failed', { error: error.message, userId: input.userId });

        // If card was allocated but transaction failed later (e.g. SMS), release the card
        if (error.message.includes('SMS') && allocatedCard) {
            try {
                await this.serviceDb.hotspotCard.update({
                    where: { id: allocatedCard.id },
                    data: { status: 'AVAILABLE', usedBy: null }
                });
                logger.info('Auto-released card due to SMS failure', { cardId: allocatedCard.id });
            } catch (releaseError: any) {
                logger.error('Failed to auto-release card', { cardId: allocatedCard.id, error: releaseError.message });
            }
        }

        // REFUND LOGIC
        if (walletTxId) {
           await this.walletService.processRefund({
             originalTransactionId: walletTxId,
             reason: 'Service execution failed: ' + error.message,
             amount: parseFloat(pkg.price.toString()), // Full refund
             userId: input.userId
           });
           
           await this.serviceDb.serviceExecutionLog.update({
             where: { id: executionLog.id },
             data: { 
               status: 'REFUNDED', 
               errorMessage: error.message,
               completedAt: new Date()
             }
           });
        } else {
           await this.serviceDb.serviceExecutionLog.update({
             where: { id: executionLog.id },
             data: { 
               status: 'FAILED', 
               errorMessage: error.message,
               completedAt: new Date()
             }
           });
        }

        if (error.message === 'OUT_OF_STOCK_RACE_CONDITION') {
           throw new AppError('Out of Stock (Just sold out)', 400);
        }
        
        throw error;
      }
    });
  }
}
