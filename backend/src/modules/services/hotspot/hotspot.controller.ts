import { Request, Response, NextFunction } from 'express';
import { HotspotService } from './hotspot.service';
import { AppError } from '../../../utils/errors';

const hotspotService = new HotspotService();

export class HotspotController {
  // ═══════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════

  async addCards(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await hotspotService.addCards(req.body, req.userId!);
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
        req.userId!,
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
        req.userId!,
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
        req.userId!,
        req.body.password
      );
      res.status(200).json({ success: true, message: 'All available cards deleted' });
    } catch (error) {
      next(error);
    }
  }

  async resetCard(req: Request, res: Response, next: NextFunction) {
    try {
      await hotspotService.resetCard(req.params.cardId, req.userId!);
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
      const result = await hotspotService.purchaseHotspot({
        userId: req.userId!,
        walletId: req.body.walletId,
        packageId: req.body.packageId,
        mobileNumber: req.body.mobileNumber,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
