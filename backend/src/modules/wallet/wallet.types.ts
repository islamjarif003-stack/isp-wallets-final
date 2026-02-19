import { TransactionCategory, TransactionStatus, TransactionType } from '@prisma/account-wallet-client';
import { Decimal } from '@prisma/account-wallet-client/runtime/library';

export interface WalletBalance {
  walletId: string;
  userId: string;
  balance: number;
  status: string;
  lastTransactionAt: Date | null;
}

export interface DebitWalletInput {
  walletId: string;
  userId: string;
  amount: number;
  category: TransactionCategory;
  idempotencyKey: string;
  externalTrxId?: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, any>;
  commission?: number;
}

export interface CreditWalletInput {
  walletId: string;
  userId: string;
  amount: number;
  category: TransactionCategory;
  idempotencyKey: string;
  externalTrxId?: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface RefundInput {
  originalTransactionId: string;
  reason: string;
  initiatedBy: string;
}

export interface AdjustmentInput {
  walletId: string;
  amount: number;
  type: TransactionType;
  reason: string;
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AddBalanceRequestInput {
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
}

export interface ApproveBalanceRequestInput {
  requestId: string;
  adminId: string;
  adminNote?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RejectBalanceRequestInput {
  requestId: string;
  adminId: string;
  adminNote: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface WalletTransactionResult {
  transactionId: string;
  walletId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  idempotencyKey: string;
  createdAt: Date;
}

export interface TransactionHistoryQuery {
  walletId?: string;
  page: number;
  limit: number;
  type?: TransactionType;
  category?: TransactionCategory;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface WalletSummary {
  walletId?: string;
  totalCredits: number;
  totalDebits: number;
  totalCommission: number;
  totalRefunds: number;
  transactionCount: number;
  balance: number;
}