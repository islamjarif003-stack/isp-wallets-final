import { Request, Response, NextFunction } from 'express';
import { StbService } from './stb.service';
import { getLogger } from '../../../utils/logger';
import { UnauthorizedError, AppError } from '../../../utils/errors';

const stbService = new StbService();

export class StbController {
  private logger = getLogger();
  // ═══════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════

  async adminReleaseStbOwnership(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await stbService.adminReleaseStbOwnership(
        req.body.stbNumber,
        req.user!.id,
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
      const includeInactive = req.user?.role === 'SUPER_ADMIN' && req.query.includeInactive === 'true';
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
      if (!req.user?.id || !req.user?.walletId) {
        this.logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await stbService.purchaseStbService({
        userId: req.user.id,
        walletId: req.user.walletId,
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
      if (!req.user?.id) throw new AppError('User ID missing', 401);

      const result = await stbService.getMyStbServices(req.user.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
