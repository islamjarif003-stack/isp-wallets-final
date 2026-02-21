import { Request, Response, NextFunction } from 'express';
import { getNotificationService } from './notification.service';
import { RoleName } from '@prisma/account-wallet-client';

const notificationService = getNotificationService();

export class NotificationController {
  async getMyNotifications(req: Request & { user?: { id: string; role: RoleName; walletId?: string; }; ipAddress?: string; }, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await notificationService.getUserNotifications(req.user!.id, page, limit);

      res.status(200).json({
        success: true,
        message: 'Notifications retrieved',
        data: result.notifications,
        unreadCount: result.unreadCount,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request & { user?: { id: string; role: RoleName; walletId?: string; }; ipAddress?: string; }, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request & { user?: { id: string; role: RoleName; walletId?: string; }; ipAddress?: string; }, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAsRead(req.params.notificationId, req.user!.id);
      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request & { user?: { id: string; role: RoleName; walletId?: string; }; ipAddress?: string; }, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  }
}