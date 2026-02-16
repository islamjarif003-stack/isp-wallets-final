import { ServiceType, PackageStatus } from '@prisma/service-client';

export interface CreateHotspotCardInput {
  packageId: string;
  codes: string[]; // For bulk add
}

export interface PurchaseHotspotInput {
  userId: string;
  walletId: string;
  packageId: string;
  mobileNumber: string;
}

export interface HotspotCardStats {
  packageId: string;
  packageName: string;
  total: number;
  available: number;
  used: number;
}
