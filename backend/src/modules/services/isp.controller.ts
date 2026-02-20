import { Request, Response, NextFunction } from 'express';
import { IspService } from './isp.service';

export class IspController {
  private readonly ispService = new IspService();

  getIspLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await this.ispService.getLogs(req.query);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  };

  retryIspJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { logId } = req.params;
      const result = await this.ispService.retryJob(logId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
