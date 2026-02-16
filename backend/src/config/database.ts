import { env } from './env';

export const databaseConfig = {
  accountWalletUrl: env.ACCOUNT_WALLET_DATABASE_URL,
  serviceUrl: env.SERVICE_DATABASE_URL,
};

let accountWalletDb: any | null = null;
let serviceDb: any | null = null;

export function getAccountWalletDb(): any {
  if (accountWalletDb) return accountWalletDb;

  try {
    const mod = require('@prisma/account-wallet-client');
    const PrismaClient = mod.PrismaClient as any;
    accountWalletDb = new PrismaClient({
      datasources: { db: { url: databaseConfig.accountWalletUrl } },
    });
    return accountWalletDb;
  } catch (error) {
    throw new Error(
      'Account-wallet Prisma client is missing. Generate @prisma/account-wallet-client before using getAccountWalletDb().'
    );
  }
}

export function getServiceDb(): any {
  if (serviceDb) return serviceDb;

  try {
    const mod = require('@prisma/service-client');
    const PrismaClient = mod.PrismaClient as any;
    serviceDb = new PrismaClient({
      datasources: { db: { url: databaseConfig.serviceUrl } },
    });
    return serviceDb;
  } catch (error) {
    throw new Error(
      'Service Prisma client is missing. Generate @prisma/service-client before using getServiceDb().'
    );
  }
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
