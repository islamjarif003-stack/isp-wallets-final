import { RoleName } from '@prisma/account-wallet-client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: RoleName;
        walletId: string;
      };
      ipAddress?: string;
    }
  }
}
