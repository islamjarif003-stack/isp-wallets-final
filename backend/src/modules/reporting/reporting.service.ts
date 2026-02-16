import { getAccountWalletDb } from '../../config/database';
import { getServiceDb } from '../../config/database';
import { logger } from '../../utils/logger';
import { Prisma } from '@prisma/account-wallet-client';

export class ReportingService {
  private walletDb = getAccountWalletDb();
  private serviceDb = getServiceDb();

  async getRevenueReport(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month') {
    type RevenueAgg = { period: string; total: string; count: string };
    type CommissionAgg = { period: string; total: string };

    let dateFormat: string;
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    const creditsByPeriod = await this.walletDb.$queryRaw<Array<RevenueAgg>>`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(amount)::text as total,
        COUNT(*)::text as count
      FROM wallet_transactions
      WHERE status = 'COMPLETED'
        AND type = 'CREDIT'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY TO_CHAR(created_at, ${dateFormat})
      ORDER BY period ASC
    `;

    const debitsByPeriod = await this.walletDb.$queryRaw<Array<RevenueAgg>>`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(amount)::text as total,
        COUNT(*)::text as count
      FROM wallet_transactions
      WHERE status = 'COMPLETED'
        AND type = 'DEBIT'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY TO_CHAR(created_at, ${dateFormat})
      ORDER BY period ASC
    `;

    const commissionByPeriod = await this.walletDb.$queryRaw<Array<CommissionAgg>>`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(amount)::text as total
      FROM wallet_transactions
      WHERE status = 'COMPLETED'
        AND category = 'COMMISSION'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY TO_CHAR(created_at, ${dateFormat})
      ORDER BY period ASC
    `;

    // Merge into unified report
    const periodsSet = new Set<string>();
    creditsByPeriod.forEach((c) => periodsSet.add(c.period));
    debitsByPeriod.forEach((d) => periodsSet.add(d.period));

    const periods = Array.from(periodsSet).sort();

    const creditMap = new Map<string, RevenueAgg>(
      creditsByPeriod.map((c) => [c.period, c] as const)
    );
    const debitMap = new Map<string, RevenueAgg>(
      debitsByPeriod.map((d) => [d.period, d] as const)
    );
    const commissionMap = new Map<string, CommissionAgg>(
      commissionByPeriod.map((c) => [c.period, c] as const)
    );

    return periods.map((period) => {
      const credits = creditMap.get(period);
      const debits = debitMap.get(period);
      const commission = commissionMap.get(period);

      const totalCredits = credits ? parseFloat(credits.total) : 0;
      const totalDebits = debits ? parseFloat(debits.total) : 0;
      const totalCommission = commission ? parseFloat(commission.total) : 0;

      return {
        period,
        totalCredits,
        totalDebits,
        totalCommission,
        netRevenue: parseFloat((totalCredits - totalDebits).toFixed(2)),
        transactionCount: (credits ? parseInt(credits.count) : 0) + (debits ? parseInt(debits.count) : 0),
      };
    });
  }

  async getWalletInflowOutflow(startDate: Date, endDate: Date) {
    const inflow = await this.walletDb.walletTransaction.aggregate({
      where: {
        status: 'COMPLETED',
        type: 'CREDIT',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    const outflow = await this.walletDb.walletTransaction.aggregate({
      where: {
        status: 'COMPLETED',
        type: 'DEBIT',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    const categoryBreakdown = await this.walletDb.$queryRaw<
      Array<{ category: string; type: string; total: string; count: string }>
    >`
      SELECT
        category,
        type,
        SUM(amount)::text as total,
        COUNT(*)::text as count
      FROM wallet_transactions
      WHERE status = 'COMPLETED'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY category, type
      ORDER BY category
    `;

    return {
      inflow: {
        total: inflow._sum.amount ? parseFloat(inflow._sum.amount.toString()) : 0,
        count: inflow._count,
      },
      outflow: {
        total: outflow._sum.amount ? parseFloat(outflow._sum.amount.toString()) : 0,
        count: outflow._count,
      },
      net: parseFloat(
        (
          (inflow._sum.amount ? parseFloat(inflow._sum.amount.toString()) : 0) -
          (outflow._sum.amount ? parseFloat(outflow._sum.amount.toString()) : 0)
        ).toFixed(2)
      ),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        type: c.type,
        total: parseFloat(c.total),
        count: parseInt(c.count),
      })),
    };
  }

  async getCommissionReport(startDate: Date, endDate: Date) {
    const commissions = await this.walletDb.walletTransaction.findMany({
      where: {
        status: 'COMPLETED',
        category: 'COMMISSION',
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCommission = commissions.reduce(
      (sum, c) => sum + parseFloat(c.amount.toString()),
      0
    );

    return {
      commissions: commissions.map((c) => ({
        id: c.id,
        amount: parseFloat(c.amount.toString()),
        description: c.description,
        referenceId: c.referenceId,
        createdAt: c.createdAt,
      })),
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      count: commissions.length,
    };
  }

  async getServiceReport(startDate: Date, endDate: Date) {
    const serviceCounts = await this.serviceDb.$queryRaw<
      Array<{ service_type: string; status: string; count: string }>
    >`
      SELECT
        service_type,
        status,
        COUNT(*)::text as count
      FROM service_execution_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY service_type, status
      ORDER BY service_type, status
    `;

    const revenueByType = await this.serviceDb.$queryRaw<
      Array<{ service_type: string; total_revenue: string }>
    >`
      SELECT
        sp.service_type,
        SUM(sp.price)::text as total_revenue
      FROM service_execution_logs sel
      JOIN service_packages sp ON sel.package_id = sp.id
      WHERE sel.status = 'COMPLETED'
        AND sel.created_at >= ${startDate}
        AND sel.created_at <= ${endDate}
      GROUP BY sp.service_type
    `;

    return {
      serviceCounts: serviceCounts.map((s) => ({
        serviceType: s.service_type,
        status: s.status,
        count: parseInt(s.count),
      })),
      revenueByType: revenueByType.map((r) => ({
        serviceType: r.service_type,
        totalRevenue: parseFloat(r.total_revenue),
      })),
    };
  }

  async getTopUsers(limit: number = 10) {
    const topByTransactions = await this.walletDb.$queryRaw<
      Array<{ user_id: string; total_spent: string; tx_count: string }>
    >`
      SELECT
        w.user_id,
        SUM(wt.amount)::text as total_spent,
        COUNT(*)::text as tx_count
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      WHERE wt.status = 'COMPLETED'
        AND wt.type = 'DEBIT'
        AND wt.category = 'SERVICE_PURCHASE'
      GROUP BY w.user_id
      ORDER BY SUM(wt.amount) DESC
      LIMIT ${limit}
    `;

    // Fetch user details
    const userIds = topByTransactions.map((t) => t.user_id);
    const users = await this.walletDb.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, mobile: true, fullName: true },
    });

    type UserLite = { id: string; mobile: string; fullName: string };
    const userMap = new Map<string, UserLite>(users.map((u: UserLite) => [u.id, u] as const));

    return topByTransactions.map((t) => {
      const user = userMap.get(t.user_id);
      return {
        userId: t.user_id,
        mobile: user?.mobile || 'Unknown',
        fullName: user?.fullName || 'Unknown',
        totalSpent: parseFloat(t.total_spent),
        transactionCount: parseInt(t.tx_count),
      };
    });
  }
}
