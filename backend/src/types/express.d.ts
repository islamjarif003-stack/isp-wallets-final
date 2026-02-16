// Express Type Definitions
import type { RoleName } from '@prisma/account-wallet-client';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: string;
      userRole?: RoleName;
      walletId?: string;
      ipAddress?: string;
    }
  }
}
