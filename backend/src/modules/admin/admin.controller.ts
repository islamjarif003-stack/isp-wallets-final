import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';

const adminService = new AdminService();

export class AdminController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      res.status(200).json({ success: true, message: 'Dashboard stats retrieved', data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getUsers({
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as string | undefined,
        role: req.query.role as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.status(200).json({ success: true, message: 'Users retrieved', data: result.users, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await adminService.getUserDetail(req.params.userId);
      res.status(200).json({ success: true, message: 'User detail retrieved', data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.updateUserStatus({
        ...req.body,
        adminId: req.user!.id,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });
      res.status(200).json({ success: true, message: 'User status updated' });
    } catch (error) {
      next(error);
    }
  }

  async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.assignRole({
        ...req.body,
        adminId: req.user!.id,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });
      res.status(200).json({ success: true, message: 'Role assigned' });
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = req.query.group as string | undefined;
      const settings = await adminService.getSettings(group);
      res.status(200).json({ success: true, message: 'Settings retrieved', data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.updateSetting({
        ...req.body,
        adminId: req.user!.id,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });
      res.status(200).json({ success: true, message: 'Setting updated' });
    } catch (error) {
      next(error);
    }
  }

  async updateSupportChannels(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await adminService.updateSupportChannels({
        ...req.body,
        adminId: req.user!.id,
        ipAddress: req.ipAddress,
        userAgent: req.get('user-agent') || 'unknown',
      });

      res.status(200).json({
        success: true,
        message: 'Support channels updated',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getAuditLogs({
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        action: req.query.action as string | undefined,
        adminId: req.query.adminId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });
      res.status(200).json({ success: true, message: 'Audit logs retrieved', data: result.logs, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await adminService.getRoles();
      res.status(200).json({ success: true, message: 'Roles retrieved', data: roles });
    } catch (error) {
      next(error);
    }
  }

  async resetUserPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.resetUserPassword({
        userId: req.body.userId,
        newPassword: req.body.newPassword,
        adminId: req.user!.id,
        reason: req.body.reason,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });
      res.status(200).json({ success: true, message: 'User password reset successfully' });
    } catch (error) {
      next(error);
    }
  }
}