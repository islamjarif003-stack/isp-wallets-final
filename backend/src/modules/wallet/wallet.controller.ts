import { Request, Response, NextFunction } from 'express';
import { WalletService } from './wallet.service';

const walletService = new WalletService();

export class WalletController {
  // ─── USER: Get my balance ────────────────────────────
  async getMyBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getBalanceByUserId(req.user!.id);

      res.status(200).json({
        success: true,
        message: 'Balance retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── USER: Get my transaction history ────────────────
  async getMyTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getTransactionHistory({
        walletId: req.user!.walletId,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        category: req.query.category as any,
        status: req.query.status as any,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Transactions retrieved',
        data: result.transactions,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── USER: Get my wallet summary ─────────────────────
  async getMyWalletSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getWalletSummary(req.user!.walletId);

      res.status(200).json({
        success: true,
        message: 'Wallet summary retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── USER: Request add balance ───────────────────────
  async requestAddBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.createAddBalanceRequest({
        userId: req.user!.id,
        amount: req.body.amount,
        paymentMethod: req.body.paymentMethod,
        paymentReference: req.body.paymentReference,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: { requestId: result.requestId, status: result.status },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAddBalanceInstructions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getAddBalanceInstructions();
      res.status(200).json({
        success: true,
        message: 'Add balance instructions retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── USER: Get my balance requests ───────────────────
  async getMyBalanceRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await walletService.getBalanceRequests(req.user!.id, status, page, limit);

      res.status(200).json({
        success: true,
        message: 'Balance requests retrieved',
        data: result.requests,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Approve balance request ──────────────────
  async approveBalanceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.approveBalanceRequest({
        requestId: req.body.requestId,
        adminId: req.user!.id,
        adminNote: req.body.adminNote,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Balance request approved and wallet credited',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Reject balance request ───────────────────
  async rejectBalanceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await walletService.rejectBalanceRequest({
        requestId: req.body.requestId,
        adminId: req.user!.id,
        adminNote: req.body.adminNote,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Balance request rejected',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Get all balance requests ─────────────────
  async getAllBalanceRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await walletService.getBalanceRequests(userId, status, page, limit);

      res.status(200).json({
        success: true,
        message: 'Balance requests retrieved',
        data: result.requests,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Wallet adjustment ────────────────────────
  async walletAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.adminAdjustment({
        walletId: req.body.walletId,
        amount: req.body.amount,
        type: req.body.type,
        reason: req.body.reason,
        adminId: req.user!.id,
        ipAddress: req.ipAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: `Wallet ${req.body.type.toLowerCase()} adjustment completed`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Freeze wallet ───────────────────────────
  async freezeWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await walletService.freezeWallet(
        req.body.walletId,
        req.user!.id,
        req.body.reason,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: 'Wallet frozen successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Unfreeze wallet ─────────────────────────
  async unfreezeWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await walletService.unfreezeWallet(
        req.body.walletId,
        req.user!.id,
        req.body.reason,
        req.ipAddress,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: 'Wallet unfrozen successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Get any wallet balance ──────────────────
  async getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getBalance(req.params.walletId);

      res.status(200).json({
        success: true,
        message: 'Balance retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Get any wallet transactions ─────────────
  async getWalletTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getTransactionHistory({
        walletId: req.params.walletId, // Optional now in service, but check usage
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        category: req.query.category as any,
        status: req.query.status as any,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Transactions retrieved',
        data: result.transactions,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Get ALL transactions (new endpoint) ──────
  async getAllTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getTransactionHistory({
        // No walletId provided -> fetch all
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        category: req.query.category as any,
        status: req.query.status as any,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'All transactions retrieved',
        data: result.transactions,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN: Get wallet summary ──────────────────────
  async getWalletSummaryAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getWalletSummary(req.params.walletId);

      res.status(200).json({
        success: true,
        message: 'Wallet summary retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
