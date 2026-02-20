import { getAccountWalletDb } from '../../config/database';
import { getLogger } from '../../utils/logger';
import { withLock } from '../../utils/distributed-lock';
import { generateIdempotencyKey, generateTransactionId } from '../../utils/idempotency';
import { createAuditLog } from '../../utils/audit';
import { paginationMeta } from '../../utils/helpers';
import { APP_CONSTANTS } from '../../config/constants';
import { AppError, ConflictError, NotFoundError, ForbiddenError, InsufficientBalanceError } from '../../utils/errors'; 
import {
  WalletBalance,
  DebitWalletInput,
  CreditWalletInput,
  RefundInput,
  AdjustmentInput,
  AddBalanceRequestInput,
  ApproveBalanceRequestInput,
  RejectBalanceRequestInput,
  WalletTransactionResult,
  TransactionHistoryQuery,
  WalletSummary,
} from './wallet.types';
import { TransactionCategory, TransactionType, Prisma } from '@prisma/account-wallet-client';

export class WalletService {
  private db = getAccountWalletDb();
  private logger = getLogger();

  // ═══════════════════════════════════════════════════════════════
  // BALANCE - ALWAYS DERIVED FROM wallet_transactions
  // ═══════════════════════════════════════════════════════════════

  async getBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: walletId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const balance = await this.deriveBalance(walletId);

    // Get last transaction date
    const lastTx = await this.db.walletTransaction.findFirst({
      where: { walletId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Sync cached balance (non-blocking, for display optimization only)
    this.syncCachedBalance(walletId, balance).catch((err) => {
      this.logger.warn('Failed to sync cached balance', { walletId, error: err.message });
    });

    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balance,
      status: wallet.status,
      lastTransactionAt: lastTx?.createdAt || null,
    };
  }

  async getBalanceByUserId(userId: string): Promise<WalletBalance> {
    const wallet = await this.db.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found for this user');
    }

    return this.getBalance(wallet.id);
  }

  async getAvailableBalance(walletId: string, userId?: string): Promise<number> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: walletId },
      select: { userId: true, status: true },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (userId && wallet.userId !== userId) {
      throw new ForbiddenError('Wallet does not belong to this user');
    }

    if (wallet.status === 'FROZEN') {
      throw new ForbiddenError('Wallet is frozen. Cannot process transactions.');
    }

    if (wallet.status === 'CLOSED') {
      throw new ForbiddenError('Wallet is closed.');
    }

    return this.deriveBalance(walletId);
  }

  /**
   * THE CORE TRUTH: Balance is ALWAYS derived from completed transactions.
   * Credits add, Debits subtract.
   */
  private async deriveBalance(walletId: string, tx?: any): Promise<number> {
    const prisma = tx || this.db;

    const creditAgg = await prisma.walletTransaction.aggregate({
      where: {
        walletId,
        status: 'COMPLETED',
        type: 'CREDIT',
      },
      _sum: { amount: true },
    });

    const debitAgg = await prisma.walletTransaction.aggregate({
      where: {
        walletId,
        status: 'COMPLETED',
        type: 'DEBIT',
      },
      _sum: { amount: true },
    });

    const credits = creditAgg._sum.amount
      ? parseFloat(creditAgg._sum.amount.toString())
      : 0;
    const debits = debitAgg._sum.amount
      ? parseFloat(debitAgg._sum.amount.toString())
      : 0;

    return parseFloat((credits - debits).toFixed(2));
  }

  private async syncCachedBalance(walletId: string, balance: number): Promise<void> {
    await this.db.wallet.update({
      where: { id: walletId },
      data: {
        cachedBalance: balance,
        lastSyncedAt: new Date(),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DEBIT WALLET - Atomic, Idempotent, Crash-Safe
  // ═══════════════════════════════════════════════════════════════

  async debitWallet(input: DebitWalletInput): Promise<WalletTransactionResult> {
    const lockKey = `wallet:${input.walletId}`;

    return withLock(lockKey, async () => {
      return this.db.$transaction(async (tx: any) => {
        if (input.commission && input.commission > 0) {
          throw new AppError('Commission is not supported', 400);
        }

        // 1. Check idempotency - if same key exists, return existing
        const existingByKey = await tx.walletTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existingByKey) {
          this.logger.warn('Duplicate idempotency key detected for debit', {
            idempotencyKey: input.idempotencyKey,
            existingId: existingByKey.id,
          });
          return this.formatTransactionResult(existingByKey);
        }

        // 2. Check duplicate external TRX ID
        if (input.externalTrxId) {
          const existingByTrx = await tx.walletTransaction.findUnique({
            where: { externalTrxId: input.externalTrxId },
          });

          if (existingByTrx) {
            throw new ConflictError(
              `Duplicate transaction ID: ${input.externalTrxId}. This transaction was already processed.`
            );
          }
        }

        // 3. Check wallet status
        const wallet = await tx.wallet.findUnique({
          where: { id: input.walletId },
        });

        if (!wallet) {
          throw new NotFoundError('Wallet not found');
        }

        if (wallet.status === 'FROZEN') {
          throw new ForbiddenError('Wallet is frozen. Cannot process transactions.');
        }

        if (wallet.status === 'CLOSED') {
          throw new ForbiddenError('Wallet is closed.');
        }

        // 4. Verify ownership
        if (wallet.userId !== input.userId) {
          throw new ForbiddenError('Wallet does not belong to this user');
        }

        // 5. Derive current balance from transactions
        const currentBalance = await this.deriveBalance(input.walletId, tx);

        // 6. Check sufficient balance
        const totalDebit = input.amount;
        if (currentBalance < totalDebit) {
          throw new InsufficientBalanceError('Insufficient balance');
        }

        // 7. Validate amount
        if (input.amount <= 0) {
          throw new AppError('Debit amount must be positive', 400);
        }

        if (input.amount > APP_CONSTANTS.WALLET.MAX_SINGLE_TRANSACTION) {
          throw new AppError(
            `Amount exceeds maximum single transaction limit of ৳${APP_CONSTANTS.WALLET.MAX_SINGLE_TRANSACTION}`,
            400
          );
        }

        const balanceAfterDebit = parseFloat((currentBalance - input.amount).toFixed(2));

        // 8. Create debit transaction
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: input.walletId,
            type: 'DEBIT',
            category: input.category,
            amount: input.amount,
            balanceBefore: currentBalance,
            balanceAfter: balanceAfterDebit,
            status: 'COMPLETED',
            idempotencyKey: input.idempotencyKey,
            externalTrxId: input.externalTrxId || null,
            description: input.description,
            referenceType: input.referenceType || null,
            referenceId: input.referenceId || null,
            metadata: input.metadata,
            commission: null,
          },
        });

        // 10. Sync cached balance
        const finalBalance = await this.deriveBalance(input.walletId, tx);
        await tx.wallet.update({
          where: { id: input.walletId },
          data: {
            cachedBalance: finalBalance,
            lastSyncedAt: new Date(),
          },
        });

        this.logger.info('Wallet debited successfully', {
          transactionId: transaction.id,
          walletId: input.walletId,
          amount: input.amount,
          commission: input.commission,
          balanceBefore: currentBalance,
          balanceAfter: finalBalance,
          category: input.category,
        });

        return this.formatTransactionResult(transaction);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CREDIT WALLET - Atomic, Idempotent, Crash-Safe
  // ═══════════════════════════════════════════════════════════════

  async creditWallet(input: CreditWalletInput): Promise<WalletTransactionResult> {
    const lockKey = `wallet:${input.walletId}`;

    return withLock(lockKey, async () => {
      return this.db.$transaction(async (tx: any) => {
        // 1. Check idempotency
        const existingByKey = await tx.walletTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existingByKey) {
          this.logger.warn('Duplicate idempotency key detected for credit', {
            idempotencyKey: input.idempotencyKey,
            existingId: existingByKey.id,
          });
          return this.formatTransactionResult(existingByKey);
        }

        // 2. Check duplicate external TRX ID
        if (input.externalTrxId) {
          const existingByTrx = await tx.walletTransaction.findUnique({
            where: { externalTrxId: input.externalTrxId },
          });

          if (existingByTrx) {
            throw new ConflictError(
              `Duplicate transaction ID: ${input.externalTrxId}`
            );
          }
        }

        // 3. Check wallet
        const wallet = await tx.wallet.findUnique({
          where: { id: input.walletId },
        });

        if (!wallet) {
          throw new NotFoundError('Wallet not found');
        }

        if (wallet.status === 'CLOSED') {
          throw new ForbiddenError('Wallet is closed');
        }

        // Frozen wallets CAN receive credits (e.g., refunds)
        // but we log a warning
        if (wallet.status === 'FROZEN') {
          this.logger.warn('Crediting frozen wallet', {
            walletId: input.walletId,
            amount: input.amount,
            category: input.category,
          });
        }

        // 4. Verify ownership
        if (wallet.userId !== input.userId) {
          throw new ForbiddenError('Wallet does not belong to this user');
        }

        // 5. Validate amount
        if (input.amount <= 0) {
          throw new AppError('Credit amount must be positive', 400);
        }

        // 6. Derive current balance
        const currentBalance = await this.deriveBalance(input.walletId, tx);
        const balanceAfter = parseFloat((currentBalance + input.amount).toFixed(2));

        // 7. Create credit transaction
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: input.walletId,
            type: 'CREDIT',
            category: input.category,
            amount: input.amount,
            balanceBefore: currentBalance,
            balanceAfter,
            status: 'COMPLETED',
            idempotencyKey: input.idempotencyKey,
            externalTrxId: input.externalTrxId || null,
            description: input.description,
            referenceType: input.referenceType || null,
            referenceId: input.referenceId || null,
            metadata: input.metadata || undefined,
          },
        });

        // 8. Sync cached balance
        await tx.wallet.update({
          where: { id: input.walletId },
          data: {
            cachedBalance: balanceAfter,
            lastSyncedAt: new Date(),
          },
        });

        this.logger.info('Wallet credited successfully', {
          transactionId: transaction.id,
          walletId: input.walletId,
          amount: input.amount,
          balanceBefore: currentBalance,
          balanceAfter,
          category: input.category,
        });

        return this.formatTransactionResult(transaction);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO REFUND - Triggered on service failure
  // ═══════════════════════════════════════════════════════════════

  async refundTransaction(input: RefundInput): Promise<WalletTransactionResult> {
    const originalTx = await this.db.walletTransaction.findUnique({
      where: { id: input.originalTransactionId },
    });

    if (!originalTx) {
      throw new NotFoundError('Original transaction not found');
    }

    if (originalTx.type !== 'DEBIT') {
      throw new AppError('Can only refund debit transactions', 400);
    }

    this.logger.debug('Checking originalTx status for refund', { transactionId: originalTx.id, status: originalTx.status });
    if (originalTx.status !== 'COMPLETED') {
      throw new AppError('Can only refund completed transactions', 400);
    }

    const refundIdempotencyKey = `refund:${originalTx.id}`;
    const existingRefund = await this.db.walletTransaction.findUnique({
      where: { idempotencyKey: refundIdempotencyKey },
    });

    if (existingRefund) {
      this.logger.warn('Refund already processed', {
        originalTransactionId: input.originalTransactionId,
        refundTransactionId: existingRefund.id,
      });
      return this.formatTransactionResult(existingRefund);
    }

    // Get wallet info
    const wallet = await this.db.wallet.findUnique({
      where: { id: originalTx.walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found for refund');
    }

    const refundAmount = parseFloat(originalTx.amount.toString());

    const refundResult = await this.creditWallet({
      walletId: originalTx.walletId,
      userId: wallet.userId,
      amount: refundAmount,
      category: 'SERVICE_REFUND',
      idempotencyKey: refundIdempotencyKey,
      description: `Refund for: ${originalTx.description}. Reason: ${input.reason}`,
      referenceType: 'REFUND',
      referenceId: originalTx.id,
      metadata: {
        originalTransactionId: originalTx.id,
        refundReason: input.reason,
        refundedAmount: refundAmount,
        initiatedBy: input.initiatedBy,
      },
    });

    this.logger.info('Refund processed successfully', {
      originalTransactionId: input.originalTransactionId,
      refundTransactionId: refundResult.transactionId,
      refundAmount,
      reason: input.reason,
    });

    return refundResult;
  }
  
// ✅ Compatibility method for services (Hotspot / Service refund)
     async processRefund(input: {
  walletId: string;
  amount: number;
  reference: string;
}) {
  return this.refundTransaction({
    originalTransactionId: input.reference,
    reason: 'Service refund',
    initiatedBy: 'SYSTEM',
  });
}
  // ═══════════════════════════════════════════════════════════════
  // ADMIN ADJUSTMENT
  // ═══════════════════════════════════════════════════════════════

  async adminAdjustment(input: AdjustmentInput): Promise<WalletTransactionResult> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: input.walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const idempotencyKey = generateIdempotencyKey();

    let result: WalletTransactionResult;

    if (input.type === 'CREDIT') {
      result = await this.creditWallet({
        walletId: input.walletId,
        userId: wallet.userId,
        amount: input.amount,
        category: 'ADMIN_ADJUSTMENT',
        idempotencyKey,
        description: `Admin adjustment (CREDIT): ${input.reason}`,
        metadata: {
          adjustedBy: input.adminId,
          reason: input.reason,
        },
      });
    } else {
      result = await this.debitWallet({
        walletId: input.walletId,
        userId: wallet.userId,
        amount: input.amount,
        category: 'ADMIN_ADJUSTMENT',
        idempotencyKey,
        description: `Admin adjustment (DEBIT): ${input.reason}`,
        metadata: {
          adjustedBy: input.adminId,
          reason: input.reason,
        },
      });
    }

    // Create audit log
    await createAuditLog({
      adminId: input.adminId,
      action: input.type === 'CREDIT' ? 'WALLET_CREDIT' : 'WALLET_DEBIT',
      targetUserId: wallet.userId,
      resourceType: 'WALLET',
      resourceId: input.walletId,
      newData: {
        transactionId: result.transactionId,
        amount: input.amount,
        type: input.type,
        reason: input.reason,
      },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // ADD BALANCE REQUEST FLOW
  // ═══════════════════════════════════════════════════════════════

  async getAddBalanceInstructions(): Promise<{
    bkashSendMoneyNumber: string | null;
    nagadSendMoneyNumber: string | null;
    rocketSendMoneyNumber: string | null;
  }> {
    const keys = [
      'bkash_send_money_number',
      'nagad_send_money_number',
      'rocket_send_money_number',
    ];

    const rows = await this.db.systemSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, String(r.value));
    }

    return {
      bkashSendMoneyNumber: map.get('bkash_send_money_number') || null,
      nagadSendMoneyNumber: map.get('nagad_send_money_number') || null,
      rocketSendMoneyNumber: map.get('rocket_send_money_number') || null,
    };
  }

  async createAddBalanceRequest(input: AddBalanceRequestInput): Promise<{
    requestId: string;
    status: string;
    message: string;
  }> {
    const paymentReference = (input.paymentReference || '').trim() || null;
    const lockKey = paymentReference
      ? `balance_ref:${input.paymentMethod}:${paymentReference.toLowerCase()}`
      : `balance_req:${input.userId}`;

    return withLock(lockKey, async () => {
      if (input.amount < APP_CONSTANTS.WALLET.MIN_ADD_BALANCE) {
        throw new AppError(
          `Minimum add balance is ৳${APP_CONSTANTS.WALLET.MIN_ADD_BALANCE}`,
          400
        );
      }

      if (input.amount > APP_CONSTANTS.WALLET.MAX_ADD_BALANCE) {
        throw new AppError(
          `Maximum add balance is ৳${APP_CONSTANTS.WALLET.MAX_ADD_BALANCE}`,
          400
        );
      }

      if (paymentReference) {
        const dup = await this.db.balanceRequest.findFirst({
          where: {
            paymentMethod: input.paymentMethod,
            paymentReference: { equals: paymentReference, mode: 'insensitive' },
          },
          select: { id: true },
        });

        if (dup) {
          throw new ConflictError('This transaction ID was already used');
        }
      }

      const pendingRequest = await this.db.balanceRequest.findFirst({
        where: {
          userId: input.userId,
          status: 'PENDING',
        },
      });

      if (pendingRequest) {
        throw new ConflictError(
          'You already have a pending balance request. Please wait for it to be processed.'
        );
      }

      const request = await this.db.balanceRequest.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          paymentReference,
          status: 'PENDING',
        },
      });

      this.logger.info('Balance add request created', {
        requestId: request.id,
        userId: input.userId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      });

      return {
        requestId: request.id,
        status: 'PENDING',
        message: 'Balance add request submitted successfully. Awaiting admin approval.',
      };
    });
  }

  async approveBalanceRequest(
    input: ApproveBalanceRequestInput
  ): Promise<WalletTransactionResult> {
    const request = await this.db.balanceRequest.findUnique({
      where: { id: input.requestId },
      include: { user: { include: { wallet: true } } },
    });

    if (!request) {
      throw new NotFoundError('Balance request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictError(`Request is already ${request.status.toLowerCase()}`);
    }

    if (!request.user.wallet) {
      throw new AppError('User wallet not found', 500);
    }

    const baseAmount = parseFloat(request.amount.toString());
    const bonusPercent = await this.getTopupBonusPercentage();
    const bonusAmount = parseFloat(((baseAmount * bonusPercent) / 100).toFixed(2));

    const baseIdempotencyKey = `balance-approve:${request.id}:amount`;
    const bonusIdempotencyKey = `balance-approve:${request.id}:bonus`;

    const amountResult = await this.creditWallet({
      walletId: request.user.wallet.id,
      userId: request.userId,
      amount: baseAmount,
      category: 'BALANCE_ADD',
      idempotencyKey: baseIdempotencyKey,
      description: `Balance added via ${request.paymentMethod}. Ref: ${request.paymentReference || 'N/A'}`,
      referenceType: 'BALANCE_REQUEST',
      referenceId: request.id,
      metadata: {
        balanceRequestId: request.id,
        paymentMethod: request.paymentMethod,
        paymentReference: request.paymentReference,
        approvedBy: input.adminId,
        bonusPercent,
      },
    });

    let bonusTransactionId: string | null = null;
    if (bonusAmount > 0) {
      const bonusResult = await this.creditWallet({
        walletId: request.user.wallet.id,
        userId: request.userId,
        amount: bonusAmount,
        category: 'TOPUP_BONUS',
        idempotencyKey: bonusIdempotencyKey,
        description: `Top-up bonus for balance request ${request.id}`,
        referenceType: 'BALANCE_REQUEST',
        referenceId: request.id,
        metadata: {
          balanceRequestId: request.id,
          approvedBy: input.adminId,
          bonusPercent,
          baseAmount,
        },
      });
      bonusTransactionId = bonusResult.transactionId;
    }

    // Update request status
    await this.db.balanceRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        approvedBy: input.adminId,
        approvedAt: new Date(),
        adminNote: input.adminNote || null,
      },
    });

    // Audit log
    await createAuditLog({
      adminId: input.adminId,
      action: 'BALANCE_APPROVE',
      targetUserId: request.userId,
      resourceType: 'BALANCE_REQUEST',
      resourceId: request.id,
      newData: {
        amount: baseAmount,
        bonusPercent,
        bonusAmount,
        paymentMethod: request.paymentMethod,
        transactionId: amountResult.transactionId,
        bonusTransactionId,
      },
      reason: input.adminNote || 'Approved',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    this.logger.info('Balance request approved', {
      requestId: request.id,
      userId: request.userId,
      amount: baseAmount,
      bonusAmount,
      bonusPercent,
      approvedBy: input.adminId,
    });

    return amountResult;
  }

  async rejectBalanceRequest(input: RejectBalanceRequestInput): Promise<void> {
    const request = await this.db.balanceRequest.findUnique({
      where: { id: input.requestId },
    });

    if (!request) {
      throw new NotFoundError('Balance request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictError(`Request is already ${request.status.toLowerCase()}`);
    }

    await this.db.balanceRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        approvedBy: input.adminId,
        approvedAt: new Date(),
        adminNote: input.adminNote,
      },
    });

    // Audit log
    await createAuditLog({
      adminId: input.adminId,
      action: 'BALANCE_REJECT',
      targetUserId: request.userId,
      resourceType: 'BALANCE_REQUEST',
      resourceId: request.id,
      newData: {
        amount: parseFloat(request.amount.toString()),
        reason: input.adminNote,
      },
      reason: input.adminNote,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    this.logger.info('Balance request rejected', {
      requestId: request.id,
      userId: request.userId,
      reason: input.adminNote,
    });
  }

  async getBalanceRequests(
    userId?: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      this.db.balanceRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              mobile: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.balanceRequest.count({ where }),
    ]);

    return {
      requests: requests.map((r: any) => ({
        ...r,
        amount: parseFloat(r.amount.toString()),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET FREEZE / UNFREEZE
  // ═══════════════════════════════════════════════════════════════

  async freezeWallet(
    walletId: string,
    adminId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.status === 'FROZEN') {
      throw new ConflictError('Wallet is already frozen');
    }

    await this.db.wallet.update({
      where: { id: walletId },
      data: { status: 'FROZEN' },
    });

    await createAuditLog({
      adminId,
      action: 'WALLET_FREEZE',
      targetUserId: wallet.userId,
      resourceType: 'WALLET',
      resourceId: walletId,
      previousData: { status: wallet.status },
      newData: { status: 'FROZEN' },
      reason,
      ipAddress,
      userAgent,
    });

    this.logger.info('Wallet frozen', { walletId, adminId, reason });
  }

  async unfreezeWallet(
    walletId: string,
    adminId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.status !== 'FROZEN') {
      throw new ConflictError('Wallet is not frozen');
    }

    await this.db.wallet.update({
      where: { id: walletId },
      data: { status: 'ACTIVE' },
    });

    await createAuditLog({
      adminId,
      action: 'WALLET_UNFREEZE',
      targetUserId: wallet.userId,
      resourceType: 'WALLET',
      resourceId: walletId,
      previousData: { status: 'FROZEN' },
      newData: { status: 'ACTIVE' },
      reason,
      ipAddress,
      userAgent,
    });

    this.logger.info('Wallet unfrozen', { walletId, adminId, reason });
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY
  // ═══════════════════════════════════════════════════════════════

  async getTransactionHistory(input: TransactionHistoryQuery) {
    const where: Prisma.WalletTransactionWhereInput = {};

    if (input.walletId) where.walletId = input.walletId;
    if (input.type) where.type = input.type;
    if (input.category) where.category = input.category;
    if (input.status) where.status = input.status;

    if (input.startDate || input.endDate) {
      where.createdAt = {};
      if (input.startDate) where.createdAt.gte = input.startDate;
      if (input.endDate) where.createdAt.lte = input.endDate;
    }

    const [transactions, total] = await Promise.all([
      this.db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { // Include wallet -> user for admin view
            wallet: {
                include: {
                    user: {
                        select: { id: true, fullName: true, mobile: true }
                    }
                }
            }
        }
      }),
      this.db.walletTransaction.count({ where }),
    ]);

    return {
      transactions,
      meta: paginationMeta(total, input.page, input.limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET SUMMARY
  // ═══════════════════════════════════════════════════════════════

  async getWalletSummary(walletId: string): Promise<WalletSummary> {
    const wallet = await this.db.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const [creditAgg, debitAgg, commissionAgg, refundAgg, txCount] =
      await Promise.all([
        this.db.walletTransaction.aggregate({
          where: { walletId, status: 'COMPLETED', type: 'CREDIT' },
          _sum: { amount: true },
        }),
        this.db.walletTransaction.aggregate({
          where: { walletId, status: 'COMPLETED', type: 'DEBIT' },
          _sum: { amount: true },
        }),
        this.db.walletTransaction.aggregate({
          where: { walletId, status: 'COMPLETED', category: 'COMMISSION' },
          _sum: { amount: true },
        }),
        this.db.walletTransaction.aggregate({
          where: { walletId, status: 'COMPLETED', category: 'SERVICE_REFUND' },
          _sum: { amount: true },
        }),
        this.db.walletTransaction.count({
          where: { walletId, status: 'COMPLETED' },
        }),
      ]);

    const totalCredits = creditAgg._sum.amount
      ? parseFloat(creditAgg._sum.amount.toString())
      : 0;
    const totalDebits = debitAgg._sum.amount
      ? parseFloat(debitAgg._sum.amount.toString())
      : 0;
    const totalCommission = commissionAgg._sum.amount
      ? parseFloat(commissionAgg._sum.amount.toString())
      : 0;
    const totalRefunds = refundAgg._sum.amount
      ? parseFloat(refundAgg._sum.amount.toString())
      : 0;

    return {
      walletId,
      totalCredits,
      totalDebits,
      totalCommission,
      totalRefunds,
      transactionCount: txCount,
      balance: parseFloat((totalCredits - totalDebits).toFixed(2)),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET COMMISSION FROM SYSTEM SETTINGS
  // ═══════════════════════════════════════════════════════════════

  async getCommissionPercentage(): Promise<number> {
    try {
      const setting = await this.db.systemSetting.findUnique({
        where: { key: 'commission_percentage' },
      });

      if (!setting) {
        this.logger.warn('Commission percentage not found in settings, using default 0');
        return 0;
      }

      const percentage = parseFloat(setting.value);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        this.logger.warn('Invalid commission percentage in settings', {
          value: setting.value,
        });
        return 0;
      }

      return percentage;
    } catch (error) {
      this.logger.error('Error fetching commission percentage', { error });
      return 0;
    }
  }

  async calculateCommission(amount: number): Promise<number> {
    return 0;
  }

  private async getTopupBonusPercentage(): Promise<number> {
    try {
      const setting = await this.db.systemSetting.findUnique({
        where: { key: 'topup_bonus_percent' },
      });

      if (!setting) {
        return 0;
      }

      const percentage = parseFloat(setting.value);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        this.logger.warn('Invalid topup bonus percent in settings', {
          value: setting.value,
        });
        return 0;
      }

      return percentage;
    } catch (error) {
      this.logger.error('Error fetching topup bonus percent', { error });
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Format transaction result
  // ═══════════════════════════════════════════════════════════════

  private formatTransactionResult(tx: any): WalletTransactionResult {
    return {
      transactionId: tx.id,
      walletId: tx.walletId,
      type: tx.type,
      category: tx.category,
      amount: parseFloat(tx.amount.toString()),
      balanceBefore: parseFloat(tx.balanceBefore.toString()),
      balanceAfter: parseFloat(tx.balanceAfter.toString()),
      status: tx.status,
      idempotencyKey: tx.idempotencyKey,
      createdAt: tx.createdAt,
    };
  }
}
