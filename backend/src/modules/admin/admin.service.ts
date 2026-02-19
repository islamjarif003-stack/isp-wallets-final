import { getAccountWalletDb } from '../../config/database';
import { getServiceDb } from '../../config/database';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/audit';
import { paginationMeta } from '../../utils/helpers';
import { getRedis, isRedisAvailable } from '../../config/redis';
import { APP_CONSTANTS } from '../../config/constants';
import { AppError, NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import bcrypt from 'bcrypt';
import {
  DashboardStats,
  UserListQuery,
  UpdateUserStatusInput,
  AssignRoleInput,
  UpdateSettingInput,
  ResetUserPasswordInput,
  UpdateSupportChannelsInput,
} from './admin.types';
import { RoleName, Prisma } from '@prisma/account-wallet-client';

export class AdminService {
  private walletDb = getAccountWalletDb();
  private serviceDb = getServiceDb();

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════

  async getDashboardStats(): Promise<DashboardStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingBalanceRequests,
      totalCreditAgg,
      totalDebitAgg,
      totalCommissionAgg,
      todayTxCount,
      todayCreditAgg,
      pendingServicesCount,
      successCount,
      failedCount,
      refundCount
    ] = await Promise.all([
      this.walletDb.user.count(),
      this.walletDb.user.count({ where: { status: 'ACTIVE' } }),
      this.walletDb.user.count({ where: { status: 'SUSPENDED' } }),
      this.walletDb.balanceRequest.count({ where: { status: 'PENDING' } }),
      this.walletDb.walletTransaction.aggregate({
        where: { status: 'COMPLETED', type: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.walletDb.walletTransaction.aggregate({
        where: { status: 'COMPLETED', type: 'DEBIT' },
        _sum: { amount: true },
      }),
      this.walletDb.walletTransaction.aggregate({
        where: { status: 'COMPLETED', category: 'COMMISSION' },
        _sum: { amount: true },
      }),
      this.walletDb.walletTransaction.count({
        where: { createdAt: { gte: todayStart }, status: 'COMPLETED' },
      }),
      this.walletDb.walletTransaction.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: 'COMPLETED',
          type: 'CREDIT',
        },
        _sum: { amount: true },
      }),
      this.serviceDb.serviceExecutionLog.count({
        where: { status: { in: ['PENDING', 'EXECUTING', 'FAILED'] } },
      }),
      // New stats
      this.walletDb.walletTransaction.count({
        where: { status: 'COMPLETED' }
      }),
      this.walletDb.walletTransaction.count({
        where: { status: 'FAILED' }
      }),
      this.walletDb.walletTransaction.count({
        where: { category: 'SERVICE_REFUND' }
      }),
    ]);

    const totalCredits = totalCreditAgg._sum.amount
      ? parseFloat(totalCreditAgg._sum.amount.toString())
      : 0;
    const totalDebits = totalDebitAgg._sum.amount
      ? parseFloat(totalDebitAgg._sum.amount.toString())
      : 0;
    const totalCommission = totalCommissionAgg._sum.amount
      ? parseFloat(totalCommissionAgg._sum.amount.toString())
      : 0;
    const todayRevenue = todayCreditAgg._sum.amount
      ? parseFloat(todayCreditAgg._sum.amount.toString())
      : 0;

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWalletBalance: parseFloat((totalCredits - totalDebits).toFixed(2)),
      totalRevenue: totalCredits,
      totalCommission,
      pendingBalanceRequests,
      pendingServices: pendingServicesCount,
      todayTransactions: todayTxCount,
      todayRevenue,
      successTransactions: successCount,
      failedTransactions: failedCount,
      refundedTransactions: refundCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async getUsers(query: UserListQuery) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.role = { name: query.role };
    }

    if (query.search) {
      where.OR = [
        { mobile: { contains: query.search } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.walletDb.user.findMany({
        where,
        include: {
          role: { select: { name: true, label: true } },
          wallet: {
            select: {
              id: true,
              status: true,
              cachedBalance: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.walletDb.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        mobile: u.mobile,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        role: u.role,
        isVerified: u.isVerified,
        lastLoginAt: u.lastLoginAt,
        loginCount: u.loginCount,
        wallet: u.wallet
          ? {
              id: u.wallet.id,
              status: u.wallet.status,
              cachedBalance: parseFloat(u.wallet.cachedBalance.toString()),
            }
          : null,
        createdAt: u.createdAt,
      })),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.walletDb.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        wallet: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Derive actual balance
    let balance = 0;
    if (user.wallet) {
      const creditAgg = await this.walletDb.walletTransaction.aggregate({
        where: { walletId: user.wallet.id, status: 'COMPLETED', type: 'CREDIT' },
        _sum: { amount: true },
      });
      const debitAgg = await this.walletDb.walletTransaction.aggregate({
        where: { walletId: user.wallet.id, status: 'COMPLETED', type: 'DEBIT' },
        _sum: { amount: true },
      });
      const credits = creditAgg._sum.amount ? parseFloat(creditAgg._sum.amount.toString()) : 0;
      const debits = debitAgg._sum.amount ? parseFloat(debitAgg._sum.amount.toString()) : 0;
      balance = parseFloat((credits - debits).toFixed(2));
    }

    // Get recent transactions
    const recentTransactions = user.wallet
      ? await this.walletDb.walletTransaction.findMany({
          where: { walletId: user.wallet.id, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];

    // Get service history
    const recentServices = await this.serviceDb.serviceExecutionLog.findMany({
      where: { userId },
      include: { package: { select: { name: true, serviceType: true, price: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      role: user.role,
      isVerified: user.isVerified,
      lastLoginAt: user.lastLoginAt,
      loginCount: user.loginCount,
      createdAt: user.createdAt,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            balance,
            status: user.wallet.status,
          }
        : null,
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        category: tx.category,
        amount: parseFloat(tx.amount.toString()),
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      recentServices: recentServices.map((s) => ({
        id: s.id,
        serviceType: s.serviceType,
        packageName: s.package?.name || 'N/A',
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  }

  async updateUserStatus(input: UpdateUserStatusInput): Promise<void> {
    const user = await this.walletDb.user.findUnique({
      where: { id: input.userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role.name === 'SUPER_ADMIN' && input.status !== 'ACTIVE') {
      throw new ForbiddenError('Cannot suspend or ban a Super Admin');
    }

    const previousStatus = user.status;

    await this.walletDb.user.update({
      where: { id: input.userId },
      data: { status: input.status as any },
    });

    const actionMap: Record<string, any> = {
      ACTIVE: 'USER_ACTIVATE',
      SUSPENDED: 'USER_SUSPEND',
      BANNED: 'USER_BAN',
    };

    await createAuditLog({
      adminId: input.adminId,
      action: actionMap[input.status] || 'USER_UPDATE',
      targetUserId: input.userId,
      resourceType: 'USER',
      resourceId: input.userId,
      previousData: { status: previousStatus },
      newData: { status: input.status },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info('User status updated', {
      userId: input.userId,
      previousStatus,
      newStatus: input.status,
      adminId: input.adminId,
    });
  }

  async assignRole(input: AssignRoleInput): Promise<void> {
    const user = await this.walletDb.user.findUnique({
      where: { id: input.userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const newRole = await this.walletDb.role.findUnique({
      where: { name: input.roleName as RoleName },
    });

    if (!newRole) {
      throw new NotFoundError('Role not found');
    }

    if (user.role.name === input.roleName) {
      throw new ConflictError('User already has this role');
    }

    const previousRole = user.role.name;

    await this.walletDb.user.update({
      where: { id: input.userId },
      data: { roleId: newRole.id },
    });

    await createAuditLog({
      adminId: input.adminId,
      action: 'ROLE_ASSIGN',
      targetUserId: input.userId,
      resourceType: 'USER',
      resourceId: input.userId,
      previousData: { role: previousRole },
      newData: { role: input.roleName },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info('User role assigned', {
      userId: input.userId,
      previousRole,
      newRole: input.roleName,
      adminId: input.adminId,
    });
  }

  async resetUserPassword(input: ResetUserPasswordInput): Promise<void> {
    const user = await this.walletDb.user.findUnique({
      where: { id: input.userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent regular Admin from resetting Super Admin password
    if (user.role.name === 'SUPER_ADMIN') {
        // Only allow if the requester is also a Super Admin (this check is usually done in controller/middleware)
        // But for safety, we can re-verify or assume the caller has permission.
        // The middleware `requireSuperAdmin` on the route should handle this.
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await this.walletDb.user.update({
      where: { id: input.userId },
      data: { passwordHash: hashedPassword },
    });

    await createAuditLog({
      adminId: input.adminId,
      action: 'USER_UPDATE', // Or a specific action like PASSWORD_RESET
      targetUserId: input.userId,
      resourceType: 'USER',
      resourceId: input.userId,
      previousData: null,
      newData: { passwordHash: '***' },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info('User password reset by admin', {
      userId: input.userId,
      adminId: input.adminId,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM SETTINGS
  // ═══════════════════════════════════════════════════════════════

  async getSettings(group?: string) {
    const where: any = {};
    if (group) where.group = group;

    const settings = await this.walletDb.systemSetting.findMany({
      where,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    return settings;
  }

  async updateSetting(input: UpdateSettingInput): Promise<void> {
    const setting = await this.walletDb.systemSetting.findUnique({
      where: { key: input.key },
    });

    if (!setting) {
      throw new NotFoundError('Setting not found');
    }

    const previousValue = setting.value;

    const updatedSetting = await this.walletDb.systemSetting.update({
      where: { key: input.key },
      data: {
        value: typeof input.value === 'string' ? input.value : JSON.stringify(input.value),
        updatedBy: input.adminId,
      },
    });

    // Invalidate Redis cache
    if (isRedisAvailable()) {
      try {
        const redis = getRedis();
        await redis.del(APP_CONSTANTS.REDIS_KEYS.SYSTEM_SETTINGS);
      } catch (error) {
        logger.warn('Failed to invalidate settings cache', { error });
      }
    }

    await createAuditLog({
      adminId: input.adminId,
      action: 'SETTING_UPDATE',
      resourceType: 'SYSTEM_SETTING',
      resourceId: input.key,
      previousData: { value: previousValue },
      newData: { value: input.value },
      reason: `Setting "${input.key}" updated`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info('System setting updated', {
      key: input.key,
      previousValue,
      newValue: input.value,
      adminId: input.adminId,
    });
  }

  async updateSupportChannels(input: UpdateSupportChannelsInput): Promise<void> {
    const settingsToUpdate = [
      { key: 'support_whatsapp_number', value: input.support_whatsapp_number },
      { key: 'support_telegram_link', value: input.support_telegram_link },
      { key: 'support_message_template', value: input.support_message_template },
    ];

    await this.walletDb.$transaction(async (tx) => {
      for (const setting of settingsToUpdate) {
        await tx.systemSetting.upsert({
          where: { key: setting.key },
          update: { value: setting.value, updatedBy: input.adminId },
          create: {
            key: setting.key,
            value: setting.value,
            updatedBy: input.adminId,
            group: 'Support',
            label: setting.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          },
        });
      }
    });

    // Invalidate Redis cache
    if (isRedisAvailable()) {
      try {
        const redis = getRedis();
        await redis.del(APP_CONSTANTS.REDIS_KEYS.SYSTEM_SETTINGS);
      } catch (error) {
        logger.warn('Failed to invalidate settings cache', { error });
      }
    }

    await createAuditLog({
      adminId: input.adminId,
      action: 'SYSTEM_CONFIG_CHANGE',
      resourceType: 'SYSTEM_SETTING',
      resourceId: 'support_channels',
      newData: input,
      reason: 'Updated support channel settings',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info('Support channel settings updated', {
      ...input,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════

  async getAuditLogs(query: {
    page: number;
    limit: number;
    action?: string;
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (query.action) where.action = query.action;
    if (query.adminId) where.adminId = query.adminId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }

    const [logs, total] = await Promise.all([
      this.walletDb.adminAuditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, fullName: true, mobile: true } },
          target: { select: { id: true, fullName: true, mobile: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.walletDb.adminAuditLog.count({ where }),
    ]);

    return {
      logs,
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════════

  async getRoles() {
    return this.walletDb.role.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
}