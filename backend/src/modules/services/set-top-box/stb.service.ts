import { getServiceDb, getAccountWalletDb } from '../../../config/database';
import { WalletService } from '../../wallet/wallet.service';
import { withLock } from '../../../utils/distributed-lock';
import { generateIdempotencyKey } from '../../../utils/idempotency';
import { logger } from '../../../utils/logger';
import { AppError, NotFoundError, ConflictError, InsufficientBalanceError } from '../../../utils/errors';
import { CreateStbPackageInput, PurchaseStbInput, UpdateStbPackageStatusInput, UpdateStbPackageInput } from './stb.types';
import { PackageStatus, ExecutionStatus } from '@prisma/service-client';
import { createAuditLog } from '../../../utils/audit';
import { notifyServicePurchased } from '../../notification/notification.queue';

export class StbService {
  private serviceDb = getServiceDb();
  private walletDb = getAccountWalletDb();
  private walletService = new WalletService();

  // ═══════════════════════════════════════════════════════════════
  // PACKAGE MANAGEMENT (ADMIN)
  // ═══════════════════════════════════════════════════════════════

  async createPackage(input: CreateStbPackageInput) {
    const pkg = await this.serviceDb.stbPackage.create({
      data: {
        name: input.name,
        price: input.price,
        validityDays: input.validityDays,
        status: 'ACTIVE',
      },
    });

    logger.info('STB Package created', { id: pkg.id, name: pkg.name });
    return {
      ...pkg,
      price: parseFloat(pkg.price.toString()),
    };
  }

  async updatePackage(packageId: string, input: UpdateStbPackageInput) {
    const existing = await this.serviceDb.stbPackage.findUnique({
      where: { id: packageId },
    });

    if (!existing) {
      throw new NotFoundError('Package not found');
    }

    const updated = await this.serviceDb.stbPackage.update({
      where: { id: packageId },
      data: {
        name: input.name,
        price: input.price,
        validityDays: input.validityDays,
        status: input.status,
      },
    });

    return {
      ...updated,
      price: parseFloat(updated.price.toString()),
    };
  }

  async updatePackageStatus(packageId: string, input: UpdateStbPackageStatusInput) {
    const existing = await this.serviceDb.stbPackage.findUnique({
      where: { id: packageId },
    });

    if (!existing) {
      throw new NotFoundError('Package not found');
    }

    const updated = await this.serviceDb.stbPackage.update({
      where: { id: packageId },
      data: { status: input.status },
    });

    return {
      ...updated,
      price: parseFloat(updated.price.toString()),
    };
  }

  async getPackages(includeInactive: boolean = false) {
    const where: any = {};
    if (!includeInactive) {
      where.status = 'ACTIVE';
    }

    const packages = await this.serviceDb.stbPackage.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    return packages.map((p) => ({
      ...p,
      price: parseFloat(p.price.toString()),
    }));
  }

  async getPackageById(packageId: string) {
    const pkg = await this.serviceDb.stbPackage.findUnique({
      where: { id: packageId },
    });

    if (!pkg) return null;

    return {
      ...pkg,
      price: parseFloat(pkg.price.toString()),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE STB SERVICE
  // ═══════════════════════════════════════════════════════════════

  async purchaseStbService(input: PurchaseStbInput) {
    const lockKey = `service:stb:${input.stbNumber}`;

    return withLock(lockKey, async () => {
      // 1. Get package
      const pkg = await this.getPackageById(input.packageId);
      if (!pkg) {
        throw new NotFoundError('Package not found');
      }
      if (pkg.status !== 'ACTIVE') {
        throw new AppError('Package is not active', 400);
      }

      // 2. Check ownership - One ACTIVE service per STB number
      const existingActive = await this.serviceDb.stbService.findFirst({
        where: {
          stbNumber: input.stbNumber,
          status: 'ACTIVE',
        },
      });

      if (existingActive) {
        const now = new Date();
        if (existingActive.endDate > now) {
          throw new ConflictError(
            `This STB number already has an active service. Valid until: ${existingActive.endDate.toLocaleString()}`
          );
        } else {
          // Auto-expire if past end date
          await this.serviceDb.stbService.update({
            where: { id: existingActive.id },
            data: { status: 'EXPIRED' },
          });
        }
      }

      // 3. Check Balance
      const price = pkg.price;
      const idempotencyKey = generateIdempotencyKey();
      const availableBalance = await this.walletService.getAvailableBalance(
        input.walletId,
        input.userId
      );

      if (availableBalance < price) {
        throw new InsufficientBalanceError('Insufficient balance');
      }

      // 4. Create Execution Log (PENDING)
      // Note: We cannot link StbPackage ID to ServiceExecutionLog.packageId because of FK constraint to ServicePackage.
      const executionLog = await this.serviceDb.serviceExecutionLog.create({
        data: {
          serviceType: 'SET_TOP_BOX',
          serviceRecordId: 'PENDING',
          packageId: null,
          userId: input.userId,
          status: 'PENDING',
          requestPayload: {
            stbPackageId: pkg.id,
            packageName: pkg.name,
            stbNumber: input.stbNumber,
            price: price,
            validityDays: pkg.validityDays
          }
        },
      });

      // 5. DEBIT WALLET
      let walletTx;
      try {
        walletTx = await this.walletService.debitWallet({
          walletId: input.walletId,
          userId: input.userId,
          amount: price,
          category: 'SERVICE_PURCHASE',
          idempotencyKey,
          description: `STB Service: ${pkg.name} for ${input.stbNumber}`,
          referenceType: 'STB_SERVICE', // Ensure this enum exists or string is allowed. WalletService usually takes string.
          referenceId: executionLog.id,
          commission: 0, // NO commission
          metadata: {
            stbPackageId: pkg.id,
            packageName: pkg.name,
            stbNumber: input.stbNumber,
          },
        });
      } catch (error) {
         // Mark log as failed
         await this.serviceDb.serviceExecutionLog.update({
            where: { id: executionLog.id },
            data: {
                status: 'FAILED',
                errorMessage: error instanceof Error ? error.message : 'Wallet debit failed',
                completedAt: new Date()
            }
         });
         throw error;
      }

      // 6. STOP HERE - MANUAL COMPLETION REQUIRED
      // We do NOT create the service record yet. We just return success.
      // The admin will complete it later.
      
      await this.serviceDb.serviceExecutionLog.update({
        where: { id: executionLog.id },
        data: {
            status: 'PENDING', // Remains PENDING
            executionMethod: 'MANUAL', // Switch to MANUAL
            walletTransactionId: walletTx.transactionId
        }
      });

      notifyServicePurchased(input.userId, `STB ${pkg.name} request submitted`);

      return {
          success: true,
          message: 'STB Service request submitted. Awaiting admin activation.'
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ═══════════════════════════════════════════════════════════════

  async adminReleaseStbOwnership(
    stbNumber: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await this.serviceDb.stbService.findFirst({
      where: {
        stbNumber,
        status: 'ACTIVE'
      },
    });

    if (!existing) {
      throw new NotFoundError('Active STB service not found for this number');
    }

    const user = await this.walletDb.user.findUnique({
      where: { id: existing.userId }
    });

    await this.serviceDb.stbService.update({
      where: { id: existing.id },
      data: { status: 'EXPIRED', endDate: new Date() },
    });

    // We also need to log this action
    await createAuditLog({
      adminId,
      action: 'SYSTEM_CONFIG_CHANGE',
      targetUserId: existing.userId,
      resourceType: 'STB_SERVICE',
      resourceId: existing.id,
      previousData: {
        id: existing.id,
        stbNumber: existing.stbNumber,
        status: existing.status
      },
      newData: { released: true, status: 'EXPIRED' },
      reason: 'Admin released STB ownership',
      ipAddress,
      userAgent
    });

    logger.info('STB ownership released by admin', {
      adminId,
      stbNumber,
      previousUserId: existing.userId
    });

    return {
      success: true,
      message: 'STB ownership released',
      data: {
        stbNumber: existing.stbNumber,
        ownerName: user?.fullName,
        ownerMobile: user?.mobile,
        expiresAt: new Date()
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════

  async getMyStbServices(userId: string) {
    const services = await this.serviceDb.stbService.findMany({
      where: { userId },
      include: {
        package: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return services.map(s => ({
        ...s,
        package: {
            ...s.package,
            price: parseFloat(s.package.price.toString())
        }
    }));
  }
}
