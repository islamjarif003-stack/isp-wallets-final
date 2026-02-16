import { Request, Response, NextFunction } from 'express';
import { ServiceService } from './service.service';
import { ServiceType, ExecutionStatus } from '@prisma/service-client';
import { logger } from '../../utils/logger';
import { UnauthorizedError } from '../../utils/errors';

const serviceService = new ServiceService();

export class ServiceController {
  // ═══════════ PACKAGES ═══════════

  async getPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceType = req.query.serviceType as ServiceType | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await serviceService.getPackages(serviceType, false, page, limit);

      res.status(200).json({
        success: true,
        message: 'Packages retrieved',
        data: result.packages,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPackageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await serviceService.getPackageById(req.params.packageId);

      if (!pkg) {
        res.status(404).json({
          success: false,
          message: 'Package not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Package retrieved',
        data: pkg,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await serviceService.createPackage(req.body);

      res.status(201).json({
        success: true,
        message: 'Package created',
        data: pkg,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await serviceService.updatePackage(req.params.packageId, req.body);

      res.status(200).json({
        success: true,
        message: 'Package updated',
        data: pkg,
      });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════ PURCHASES ═══════════

  async purchaseHomeInternet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.walletId) {
        logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await serviceService.purchaseHomeInternet({
        userId: req.user.id,
        walletId: req.user.walletId,
        packageId: req.body.packageId,
        connectionId: req.body.connectionId,
        ipAddress: req.ipAddress,
      });

      const statusCode = result.status === 'COMPLETED' ? 200 : 202;

      res.status(statusCode).json({
        success: result.status === 'COMPLETED',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async purchaseHotspot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.walletId) {
        logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await serviceService.purchaseHotspot({
        userId: req.user.id,
        walletId: req.user.walletId,
        packageId: req.body.packageId,
        deviceMac: req.body.deviceMac,
        zoneId: req.body.zoneId,
      });

      const statusCode = result.status === 'COMPLETED' ? 200 : 202;

      res.status(statusCode).json({
        success: result.status === 'COMPLETED',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async purchaseMobileRecharge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.walletId) {
        logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await serviceService.purchaseMobileRecharge({
        userId: req.user.id,
        walletId: req.user.walletId,
        mobileNumber: req.body.mobileNumber,
        operator: req.body.operator,
        amount: req.body.amount,
        rechargeType: req.body.rechargeType,
      });

      const statusCode = result.status === 'COMPLETED' ? 200 : 202;

      res.status(statusCode).json({
        success: result.status === 'COMPLETED',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async purchaseElectricityBill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.walletId) {
        logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await serviceService.purchaseElectricityBill({
        userId: req.user.id,
        walletId: req.user.walletId,
        meterNumber: req.body.meterNumber,
        provider: req.body.provider,
        accountHolder: req.body.accountHolder,
        amount: req.body.amount,
        billMonth: req.body.billMonth,
      });

      const statusCode = result.status === 'COMPLETED' ? 200 : 202;

      res.status(statusCode).json({
        success: result.status === 'COMPLETED',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════ HISTORY ═══════════

  async getMyServiceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.getUserServiceHistory(
        req.user.id,
        req.query.serviceType as ServiceType | undefined,
        req.query.status as ExecutionStatus | undefined,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Service history retrieved',
        data: result.services,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyHomeServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const services = await serviceService.getUserHomeServices(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Home services retrieved',
        data: services,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyHotspotServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const services = await serviceService.getUserHotspotServices(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Hotspot services retrieved',
        data: services,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyRechargeHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.getUserRechargeHistory(
        req.user.id,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Recharge history retrieved',
        data: result.recharges,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyElectricityHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.getUserElectricityHistory(
        req.user.id,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Electricity bill history retrieved',
        data: result.bills,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════ ADMIN ═══════════

  async getPendingServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await serviceService.getPendingServices(
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Pending services retrieved',
        data: result.services,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllExecutionLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await serviceService.getAllExecutionLogs(
        req.query.serviceType as ServiceType | undefined,
        req.query.status as ExecutionStatus | undefined,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Execution logs retrieved',
        data: result.logs,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async adminManualExecute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.adminManualExecute(
        req.params.executionLogId,
        req.user.id,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  async adminManualRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.adminManualRefund(
        req.params.executionLogId,
        req.user.id,
        req.body.reason,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: { refundTransactionId: result.refundTransactionId },
      });
    } catch (error) {
      next(error);
    }
  }

  async adminReleaseHomeConnectionOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('User not authenticated');
      }
      const result = await serviceService.adminReleaseHomeConnectionOwnership(
        req.body.connectionId,
        req.user.id,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPackagesAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceType = req.query.serviceType as ServiceType | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await serviceService.getPackages(serviceType, true, page, limit);

      res.status(200).json({
        success: true,
        message: 'Packages retrieved',
        data: result.packages,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}
