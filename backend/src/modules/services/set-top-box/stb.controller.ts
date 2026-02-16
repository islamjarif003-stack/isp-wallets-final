import { Request, Response, NextFunction } from 'express';
import { StbService } from './stb.service';
import { AppError } from '../../../utils/errors';

const stbService = new StbService();

export class StbController {
  // ═══════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════

  async adminReleaseStbOwnership(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await stbService.adminReleaseStbOwnership(
        req.body.stbNumber,
        req.userId!,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  async createPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await stbService.createPackage(req.body);
      res.status(201).json({
        success: true,
        message: 'STB Package created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      const result = await stbService.updatePackage(packageId, req.body);
      res.status(200).json({
        success: true,
        message: 'STB Package updated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePackageStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      const result = await stbService.updatePackageStatus(packageId, req.body);
      res.status(200).json({
        success: true,
        message: 'STB Package status updated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC / USER
  // ═══════════════════════════════════════════════════════════════

  async getPackages(req: Request, res: Response, next: NextFunction) {
    try {
      // If admin, can see inactive?
      // For now, strict: only active for users, all for admin if query param set
      const includeInactive = req.userRole === 'SUPER_ADMIN' && req.query.includeInactive === 'true';
      const result = await stbService.getPackages(includeInactive);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async purchaseStbService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('User ID missing', 401);

      const result = await stbService.purchaseStbService({
        userId: req.userId,
        walletId: req.body.walletId,
        packageId: req.body.packageId,
        stbNumber: req.body.stbNumber,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMyStbServices(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('User ID missing', 401);

      const result = await stbService.getMyStbServices(req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
