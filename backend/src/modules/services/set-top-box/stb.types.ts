import { PackageStatus } from '@prisma/service-client';

export interface CreateStbPackageInput {
  name: string;
  price: number;
  validityDays: number;
}

export interface UpdateStbPackageInput {
  name?: string;
  price?: number;
  validityDays?: number;
  status?: PackageStatus;
}

export interface PurchaseStbInput {
  userId: string;
  walletId: string;
  packageId: string;
  stbNumber: string;
}

export interface UpdateStbPackageStatusInput {
  status: PackageStatus;
}
