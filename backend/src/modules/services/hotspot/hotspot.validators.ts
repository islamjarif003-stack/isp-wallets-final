import { z } from 'zod';

export const addHotspotCardsSchema = z.object({
  packageId: z.string().uuid(),
  codes: z.array(z.string().min(5).max(100)).min(1),
});

export const purchaseHotspotSchema = z.object({
  packageId: z.string().uuid(),
  mobileNumber: z.string().regex(/^01\d{9}$/, 'Invalid mobile number'),
  walletId: z.string().uuid(),
});
