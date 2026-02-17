import { Request, Response, NextFunction } from 'express';
import { systemService } from './system.service';

class SystemController {
  async getSupportChannels(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await systemService.getSupportChannels();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const systemController = new SystemController();
