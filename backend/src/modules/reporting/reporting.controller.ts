import { Request, Response, NextFunction } from 'express';
import { ReportingService } from './reporting.service';
import { ExcelExportService } from './excel-export.service';

const reportingService = new ReportingService();
const excelExportService = new ExcelExportService();

export class ReportingController {
  async getRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, groupBy } = req.query;
      const result = await reportingService.getRevenueReport(
        new Date(startDate as string),
        new Date(endDate as string),
        (groupBy as 'day' | 'week' | 'month') || 'day'
      );
      res.status(200).json({ success: true, message: 'Revenue report generated', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getInflowOutflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const result = await reportingService.getWalletInflowOutflow(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.status(200).json({ success: true, message: 'Inflow/outflow report generated', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCommissionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const result = await reportingService.getCommissionReport(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.status(200).json({ success: true, message: 'Commission report generated', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getServiceReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const result = await reportingService.getServiceReport(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.status(200).json({ success: true, message: 'Service report generated', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTopUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await reportingService.getTopUsers(limit);
      res.status(200).json({ success: true, message: 'Top users retrieved', data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, walletId } = req.query;
      const buffer = await excelExportService.exportTransactions(
        new Date(startDate as string),
        new Date(endDate as string),
        walletId as string | undefined
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buffer = await excelExportService.exportUsers();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportServiceLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const buffer = await excelExportService.exportServiceLogs(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=service_logs_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const buffer = await excelExportService.exportRevenueReport(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=revenue_report_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}