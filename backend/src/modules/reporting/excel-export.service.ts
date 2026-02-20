import ExcelJS from 'exceljs';
import { getAccountWalletDb } from '../../config/database';
import { getServiceDb } from '../../config/database';
import { getLogger } from '../../utils/logger';
const logger = getLogger();

export class ExcelExportService {
  private walletDb = getAccountWalletDb();
  private serviceDb = getServiceDb();

  async exportTransactions(
    startDate: Date,
    endDate: Date,
    walletId?: string
  ): Promise<Buffer> {
    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
      status: 'COMPLETED',
    };
    if (walletId) where.walletId = walletId;

    const transactions = await this.walletDb.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ISP Wallet Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Transaction ID', key: 'id', width: 40 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount (৳)', key: 'amount', width: 15 },
      { header: 'Balance Before', key: 'balanceBefore', width: 15 },
      { header: 'Balance After', key: 'balanceAfter', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Commission', key: 'commission', width: 12 },
      { header: 'External TRX ID', key: 'externalTrxId', width: 30 },
      { header: 'Date', key: 'createdAt', width: 22 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true, size: 11 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    transactions.forEach((tx) => {
      sheet.addRow({
        id: tx.id,
        type: tx.type,
        category: tx.category,
        amount: parseFloat(tx.amount.toString()),
        balanceBefore: parseFloat(tx.balanceBefore.toString()),
        balanceAfter: parseFloat(tx.balanceAfter.toString()),
        status: tx.status,
        description: tx.description || '',
        commission: tx.commission ? parseFloat(tx.commission.toString()) : 0,
        externalTrxId: tx.externalTrxId || '',
        createdAt: tx.createdAt.toISOString(),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportUsers(): Promise<Buffer> {
    const users = await this.walletDb.user.findMany({
      include: {
        role: { select: { name: true } },
        wallet: { select: { cachedBalance: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ISP Wallet Platform';
    const sheet = workbook.addWorksheet('Users');

    sheet.columns = [
      { header: 'User ID', key: 'id', width: 40 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Wallet Status', key: 'walletStatus', width: 15 },
      { header: 'Wallet Balance', key: 'walletBalance', width: 15 },
      { header: 'Last Login', key: 'lastLoginAt', width: 22 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    users.forEach((u) => {
      sheet.addRow({
        id: u.id,
        mobile: u.mobile,
        fullName: u.fullName,
        email: u.email || '',
        role: u.role.name,
        status: u.status,
        walletStatus: u.wallet?.status || 'N/A',
        walletBalance: u.wallet ? parseFloat(u.wallet.cachedBalance.toString()) : 0,
        lastLoginAt: u.lastLoginAt?.toISOString() || '',
        createdAt: u.createdAt.toISOString(),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportServiceLogs(startDate: Date, endDate: Date): Promise<Buffer> {
    const logs = await this.serviceDb.serviceExecutionLog.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { package: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ISP Wallet Platform';
    const sheet = workbook.addWorksheet('Service Logs');

    sheet.columns = [
      { header: 'Log ID', key: 'id', width: 40 },
      { header: 'Service Type', key: 'serviceType', width: 18 },
      { header: 'Package Name', key: 'packageName', width: 25 },
      { header: 'Package Price', key: 'packagePrice', width: 15 },
      { header: 'User ID', key: 'userId', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Method', key: 'method', width: 12 },
      { header: 'Wallet TXN ID', key: 'walletTxId', width: 40 },
      { header: 'Error', key: 'error', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Completed At', key: 'completedAt', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    logs.forEach((log) => {
      sheet.addRow({
        id: log.id,
        serviceType: log.serviceType,
        packageName: log.package?.name || 'N/A',
        packagePrice: log.package ? parseFloat(log.package.price.toString()) : 0,
        userId: log.userId,
        status: log.status,
        method: log.executionMethod,
        walletTxId: log.walletTransactionId || '',
        error: log.errorMessage || '',
        createdAt: log.createdAt.toISOString(),
        completedAt: log.completedAt?.toISOString() || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportRevenueReport(startDate: Date, endDate: Date): Promise<Buffer> {
    const transactions = await this.walletDb.walletTransaction.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ISP Wallet Platform';
    const sheet = workbook.addWorksheet('Revenue Report');

    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Amount (৳)', key: 'amount', width: 15 },
      { header: 'Description', key: 'description', width: 50 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    let totalCredits = 0;
    let totalDebits = 0;

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount.toString());
      if (tx.type === 'CREDIT') totalCredits += amount;
      else totalDebits += amount;

      sheet.addRow({
        date: tx.createdAt.toISOString().split('T')[0],
        type: tx.type,
        category: tx.category,
        amount,
        description: tx.description || '',
      });
    });

    // Summary row
    sheet.addRow({});
    const summaryRow = sheet.addRow({
      date: 'TOTAL',
      type: '',
      category: '',
      amount: '',
      description: '',
    });
    summaryRow.font = { bold: true };

    sheet.addRow({ date: 'Total Credits', amount: totalCredits });
    sheet.addRow({ date: 'Total Debits', amount: totalDebits });
    sheet.addRow({ date: 'Net', amount: parseFloat((totalCredits - totalDebits).toFixed(2)) });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}