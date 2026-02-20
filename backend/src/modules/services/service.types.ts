import { ServiceType, PackageStatus } from '@prisma/service-client';

export type CreatePackageInput = {
  serviceType: ServiceType;
  name: string;
  description?: string;
  price: number;
  commission?: number;
  validity?: number;
  bandwidth?: string;
  dataLimit?: string;
  status?: PackageStatus;
  metadata?: Record<string, any>;
  sortOrder?: number;
};

export type UpdatePackageInput = Partial<CreatePackageInput>;

export type PurchaseHomeInternetInput = {
  userId: string;
  walletId: string;
  packageId: string;
  connectionId: string;
  subscriberName: string;
  address: string;
  area?: string;
};

export type PurchaseHotspotInput = {
  userId: string;
  walletId: string;
  packageId: string;
  deviceMac?: string;
  zoneId?: string;
};

export type PurchaseMobileRechargeInput = {
  userId: string;
  walletId: string;
  mobileNumber: string;
  operator: string;
  amount: number;
  rechargeType: string;
};

export type PurchaseElectricityInput = {
  userId: string;
  walletId: string;
  meterNumber: string;
  provider: string;
  amount: number;
  billMonth?: string;
  accountHolder?: string;
};

export type ServiceExecutionResult = {
  serviceRecordId: string;
  executionLogId: string;
  status: string;
  walletTransactionId?: string;
  refundTransactionId?: string;
  message: string;
};

export interface IServiceExecution {
  id: string;
  userId: string;
}
