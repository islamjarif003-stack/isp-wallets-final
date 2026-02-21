import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RoleName } from '@prisma/account-wallet-client';

const authService = new AuthService();

export class AuthController {
  async signupRequestOtp(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.signupRequestOtp(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async signupComplete(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.signupComplete(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.login(req.body);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPasswordRequest(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.forgotPasswordRequest(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPasswordReset(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.forgotPasswordReset(req.body);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.refreshToken(req.body);

      res.status(200).json({
        success: true,
        message: 'Token refreshed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: Request & { user?: { id: string; role: RoleName; walletId?: string; } },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.getProfile(req.user!.id);

      res.status(200).json({
        success: true,
        message: 'Profile retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
