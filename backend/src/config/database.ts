import { env } from './env';

export const databaseConfig = {
  accountWalletUrl: env.ACCOUNT_WALLET_DATABASE_URL,
  serviceUrl: env.SERVICE_DATABASE_URL,
};

import { PrismaClient as AccountWalletPrismaClient } from '@prisma/account-wallet-client';
import { PrismaClient as ServicePrismaClient } from '@prisma/service-client';

let accountWalletDb: AccountWalletPrismaClient | null = null;
let serviceDb: ServicePrismaClient | null = null;

export function getAccountWalletDb(): AccountWalletPrismaClient {
  if (accountWalletDb) return accountWalletDb;

  accountWalletDb = new AccountWalletPrismaClient({
    datasources: { db: { url: databaseConfig.accountWalletUrl } },
  });
  return accountWalletDb;
}

export function getServiceDb(): ServicePrismaClient {
  if (serviceDb) return serviceDb;

  serviceDb = new ServicePrismaClient({
    datasources: { db: { url: databaseConfig.serviceUrl } },
  });
  return serviceDb;
}

export async function connectDatabases(): Promise<void> {
  const wallet = getAccountWalletDb();
  const service = getServiceDb();
  await Promise.all([wallet.$connect(), service.$connect()]);
}

export async function disconnectDatabases(): Promise<void> {
  const disconnects: Array<Promise<void>> = [];
  if (accountWalletDb) {
    disconnects.push(accountWalletDb.$disconnect());
  }
  if (serviceDb) {
    disconnects.push(serviceDb.$disconnect());
  }
  await Promise.all(disconnects);
}
