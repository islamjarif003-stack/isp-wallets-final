import { z } from 'zod';

export const addBalanceRequestSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(10, 'Minimum add balance is 10')
    .max(100000, 'Maximum add balance is 100000'),
  paymentMethod: z.enum(['BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER', 'CASH']),
  paymentReference: z
    .string()
    .trim()
    .max(255, 'Payment reference too long')
    .optional(),
}).superRefine((val, ctx) => {
  const method = val.paymentMethod;
  const ref = (val.paymentReference || '').trim();
  const needsTrx = method === 'BKASH' || method === 'NAGAD' || method === 'ROCKET';

  if (needsTrx && !ref) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['paymentReference'],
      message: 'Transaction ID is required',
    });
    return;
  }

  if (ref) {
    const ok = /^[A-Za-z0-9_-]{6,64}$/.test(ref);
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentReference'],
        message: 'Invalid transaction ID format',
      });
    }
  }
});

export const approveBalanceRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  adminNote: z.string().trim().max(500).optional(),
});

export const rejectBalanceRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  adminNote: z
    .string()
    .trim()
    .min(5, 'Rejection reason must be at least 5 characters')
    .max(500, 'Rejection reason too long'),
});

export const adjustmentSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(500000, 'Maximum adjustment is 500000'),
  type: z.enum(['CREDIT', 'DEBIT']),
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason too long'),
});

export const transactionHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  category: z
    .enum([
      'BALANCE_ADD',
      'BALANCE_ADD_APPROVED',
      'SERVICE_PURCHASE',
      'SERVICE_REFUND',
      'ADMIN_ADJUSTMENT',
      'COMMISSION',
      'SYSTEM_CREDIT',
      'SYSTEM_DEBIT',
    ])
    .optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const walletIdParamSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
});

export const freezeWalletSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters')
    .max(500),
});
