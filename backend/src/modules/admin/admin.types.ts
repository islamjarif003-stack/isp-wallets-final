import { z } from 'zod';
import { updateSupportChannelsSchema } from './admin.validators';

export type UpdateSupportChannelsInput = z.infer<typeof updateSupportChannelsSchema> & {
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
};

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalWalletBalance: number;
  totalRevenue: number;
  totalCommission: number;
  pendingBalanceRequests: number;
  pendingServices: number;
  todayTransactions: number;
  todayRevenue: number;
  // Transaction breakdown
  successTransactions: number;
  failedTransactions: number;
  refundedTransactions: number;
}

export interface RevenueAnalytics {
  period: string;
  totalCredits: number;
  totalDebits: number;
  totalCommission: number;
  netRevenue: number;
  transactionCount: number;
}

export interface UserListQuery {
  page: number;
  limit: number;
  status?: string;
  role?: string;
  search?: string;
}

export interface UpdateUserStatusInput {
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  reason: string;
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AssignRoleInput {
  userId: string;
  roleName: string;
  adminId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateSettingInput {
  key: string;
  value: string | number | boolean;
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetUserPasswordInput {
  userId: string;
  newPassword: string;
  adminId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}