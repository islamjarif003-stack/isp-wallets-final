import { z } from 'zod';

export const createStbPackageSchema = z.object({
  name: z.string().min(3).max(100),
  price: z.number().min(0),
  validityDays: z.number().int().min(1),
});

export const updateStbPackageSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  price: z.number().min(0).optional(),
  validityDays: z.number().int().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateStbPackageStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const purchaseStbSchema = z.object({
  packageId: z.string().uuid(),
  stbNumber: z.string().min(3).max(50),
  walletId: z.string().uuid(),
});
