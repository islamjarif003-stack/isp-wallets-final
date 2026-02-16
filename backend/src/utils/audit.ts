import { getAccountWalletDb } from '../config/database';

export const audit = {};

export type CreateAuditLogInput = {
  adminId: string;
  action: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  previousData?: unknown;
  newData?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  const db = getAccountWalletDb();
  await db.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetUserId: input.targetUserId || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      previousData: input.previousData ?? undefined,
      newData: input.newData ?? undefined,
      reason: input.reason || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    },
  });
}
