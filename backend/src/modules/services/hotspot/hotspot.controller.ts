import { Request, Response, NextFunction } from 'express';
import { HotspotService } from './hotspot.service';
import { logger } from '../../../utils/logger';
import { UnauthorizedError } from '../../../utils/errors';

const hotspotService = new HotspotService();

export class HotspotController {
  // ═══════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════

  async addCards(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await hotspotService.addCards(req.body, req.user!.id);
      res.status(201).json({
        success: true,
        message: 'Cards processed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getCardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await hotspotService.getCardStats();
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsedCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.query;
      const result = await hotspotService.getUsedCards(packageId as string);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.query;
      const result = await hotspotService.getAvailableCards(packageId as string);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCard(req: Request, res: Response, next: NextFunction) {
    try {
      await hotspotService.updateCard(
        req.params.cardId,
        req.body.code,
        req.user!.id,
        req.body.password
      );
      res.status(200).json({ success: true, message: 'Card updated' });
    } catch (error) {
      next(error);
    }
  }

  async deleteCard(req: Request, res: Response, next: NextFunction) {
    try {
      await hotspotService.deleteCard(
        req.params.cardId,
        req.user!.id,
        req.body.password
      );
      res.status(200).json({ success: true, message: 'Card deleted' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAllAvailableCards(req: Request, res: Response, next: NextFunction) {
    try {
      await hotspotService.deleteAllAvailableCards(
        req.body.packageId,
        req.user!.id,
        req.body.password
      );
      res.status(200).json({ success: true, message: 'All available cards deleted' });
    } catch (error) {
      next(error);
    }
  }

  async resetCard(req: Request, res: Response, next: NextFunction) {
    try {
      await hotspotService.resetCard(req.params.cardId, req.user!.id);
      res.status(200).json({
        success: true,
        message: 'Card reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // USER
  // ═══════════════════════════════════════════════════════════════

  async getStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      const result = await hotspotService.getPackageStock(packageId);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async purchaseHotspot(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id || !req.user?.walletId) {
        logger.warn('Auth data missing in service purchase', { path: req.path });
        throw new UnauthorizedError('Authentication details are missing. Please log in again.');
      }

      const result = await hotspotService.purchaseHotspot({
        userId: req.user.id,
        walletId: req.user.walletId,
        packageId: req.body.packageId,
        mobileNumber: req.body.mobileNumber,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
