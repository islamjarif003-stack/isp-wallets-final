import { z } from 'zod';

export const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().trim().min(5).max(500),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleName: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
  reason: z.string().trim().min(5).max(500),
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(100),
  reason: z.string().trim().min(5).max(500),
});

export const updateSettingSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().min(0).max(1000),
});

export const updateSupportChannelsSchema = z.object({
  support_whatsapp_number: z.string().trim().max(20),
  support_telegram_link: z.string().trim().max(255),
  support_message_template: z.string().trim().max(200),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION']).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']).optional(),
  search: z.string().trim().max(100).optional(),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().optional(),
  adminId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const reportQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});