import { RoleName } from '@prisma/account-wallet-client';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: RoleName;
      walletId?: string;
      ipAddress?: string;
    }
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}