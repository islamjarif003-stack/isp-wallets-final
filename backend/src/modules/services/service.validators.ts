import { z } from 'zod';

export const createPackageSchema = z.object({
  serviceType: z.enum(['HOME_INTERNET', 'HOTSPOT_WIFI', 'MOBILE_RECHARGE', 'ELECTRICITY_BILL']),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  price: z.number().positive().max(500000),
  commission: z.number().min(0).max(100000).default(0),
  validity: z.number().int().positive().optional(),
  bandwidth: z.string().trim().max(50).optional(),
  dataLimit: z.string().trim().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  price: z.number().positive().max(500000).optional(),
  commission: z.number().min(0).max(100000).optional(),
  validity: z.number().int().positive().optional(),
  bandwidth: z.string().trim().max(50).optional(),
  dataLimit: z.string().trim().max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const purchaseHomeInternetSchema = z.object({
  packageId: z.string().uuid(),
  connectionId: z.string().trim().min(3).max(50),
  subscriberName: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(500),
  area: z.string().trim().max(100).optional(),
});

export const purchaseHotspotSchema = z.object({
  packageId: z.string().uuid(),
  deviceMac: z.string().trim().max(20).optional(),
  zoneId: z.string().trim().max(50).optional(),
});

export const purchaseMobileRechargeSchema = z.object({
  mobileNumber: z.string().trim().regex(/^01[3-9]\d{8}$/, 'Invalid Bangladesh mobile number'),
  operator: z.enum(['GRAMEENPHONE', 'ROBI', 'BANGLALINK', 'TELETALK', 'AIRTEL']),
  amount: z.number().positive().min(10).max(10000),
  rechargeType: z.enum(['PREPAID', 'POSTPAID', 'SKITTO', 'DATA_PACK']),
});

export const purchaseElectricitySchema = z.object({
  meterNumber: z.string().trim().min(5).max(50),
  provider: z.enum(['DPDC', 'DESCO', 'NESCO', 'BPDB', 'WZPDCL', 'BREB']),
  accountHolder: z.string().trim().max(100).optional(),
  amount: z.number().positive().min(50).max(100000),
  billMonth: z.string().trim().max(20).optional(),
});

export const packageIdParamSchema = z.object({
  packageId: z.string().uuid(),
});

export const serviceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  serviceType: z.enum(['HOME_INTERNET', 'HOTSPOT_WIFI', 'MOBILE_RECHARGE', 'ELECTRICITY_BILL']).optional(),
  status: z.enum(['PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
});