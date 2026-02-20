import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getAccountWalletDb } from '../../config/database';
import { env } from '../../config/env';
import { getLogger } from '../../utils/logger';
import { sanitizeMobile } from '../../utils/helpers';
import { OtpService } from '../otp/otp.service';
import {
  SignupRequestOtpInput,
  SignupCompleteInput,
  LoginInput,
  ForgotPasswordRequestInput,
  ForgotPasswordResetInput,
  RefreshTokenInput,
  AuthResponse,
  AuthTokens,
} from './auth.types';
import {
  AppError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors';
import { RoleName } from '@prisma/account-wallet-client';

export class AuthService {
  private db = getAccountWalletDb();
  private otpService = new OtpService();
  private logger = getLogger();

  async signupRequestOtp(
    input: SignupRequestOtpInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    const mobile = sanitizeMobile(input.mobile);

    const existing = await this.db.user.findUnique({
      where: { mobile },
    });

    if (existing && existing.isVerified) {
      throw new ConflictError(
        'An account with this mobile number already exists'
      );
    }

    if (existing && !existing.isVerified) {
      await this.db.$transaction(async (tx) => {
        await tx.wallet.deleteMany({ where: { userId: existing.id } });
        await tx.otpRequest.deleteMany({ where: { userId: existing.id } });
        await tx.user.delete({ where: { id: existing.id } });
      });
    }

    await this.otpService.sendOtp({
      mobile,
      type: 'SIGNUP_VERIFICATION',
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: 'OTP sent to your mobile number',
    };
  }

  async signupComplete(
    input: SignupCompleteInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    const mobile = sanitizeMobile(input.mobile);

    await this.otpService.verifyOtp({
      mobile,
      otp: input.otp,
      type: 'SIGNUP_VERIFICATION',
    });

    const existing = await this.db.user.findUnique({
      where: { mobile },
    });

    if (existing && existing.isVerified) {
      throw new ConflictError('Account already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    let userRole = await this.db.role.findUnique({
      where: { name: 'USER' as RoleName },
    });

    if (!userRole) {
      userRole = await this.db.role.create({
        data: { name: 'USER' as RoleName, label: 'Regular User' },
      });
    }

    const result = await this.db.$transaction(async (tx) => {
      if (existing) {
        await tx.wallet.deleteMany({ where: { userId: existing.id } });
        await tx.user.delete({ where: { id: existing.id } });
      }

      const user = await tx.user.create({
        data: {
          mobile,
          passwordHash,
          fullName: input.fullName,
          email: input.email || null,
          roleId: userRole!.id,
          status: 'ACTIVE',
          isVerified: true,
          lastLoginAt: new Date(),
          loginCount: 1,
        },
        include: { role: true },
      });

      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          status: 'ACTIVE',
          cachedBalance: 0,
        },
      });

      return { user, wallet };
    });

    const tokens = this.generateTokens({
      userId: result.user.id,
      role: result.user.role.name,
      walletId: result.wallet.id,
    });

    this.logger.info('User signup completed', {
      userId: result.user.id,
      mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
    });

    return {
      user: {
        id: result.user.id,
        mobile: result.user.mobile,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role.name,
        isVerified: result.user.isVerified,
      },
      wallet: {
        id: result.wallet.id,
        status: result.wallet.status,
      },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const mobile = sanitizeMobile(input.mobile);

    const user = await this.db.user.findUnique({
      where: { mobile },
      include: { role: true, wallet: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid mobile number or password');
    }

    if (!user.isVerified) {
      throw new AppError(
        'Account not verified. Please complete signup.',
        403
      );
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(
        'Your account has been suspended. Contact support.',
        403
      );
    }

    if (user.status === 'BANNED') {
      throw new AppError('Your account has been banned.', 403);
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid mobile number or password');
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    let wallet = user.wallet;
    if (!wallet) {
      wallet = await this.db.wallet.create({
        data: {
          userId: user.id,
          status: 'ACTIVE',
          cachedBalance: 0,
        },
      });
    }

    const tokens = this.generateTokens({
      userId: user.id,
      role: user.role.name,
      walletId: wallet.id,
    });

    this.logger.info('User logged in', {
      userId: user.id,
      role: user.role.name,
    });

    return {
      user: {
        id: user.id,
        mobile: user.mobile,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name,
        isVerified: user.isVerified,
      },
      wallet: {
        id: wallet.id,
        status: wallet.status,
      },
      tokens,
    };
  }

  async forgotPasswordRequest(
    input: ForgotPasswordRequestInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    const mobile = sanitizeMobile(input.mobile);

    const user = await this.db.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      return {
        success: true,
        message: 'If an account exists, OTP has been sent',
      };
    }

    if (!user.isVerified) {
      throw new AppError('Account not verified', 400);
    }

    await this.otpService.sendOtp({
      mobile,
      type: 'FORGOT_PASSWORD',
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: 'If an account exists, OTP has been sent',
    };
  }

  async forgotPasswordReset(
    input: ForgotPasswordResetInput
  ): Promise<{ success: boolean; message: string }> {
    const mobile = sanitizeMobile(input.mobile);

    await this.otpService.verifyOtp({
      mobile,
      otp: input.otp,
      type: 'FORGOT_PASSWORD',
    });

    const user = await this.db.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await this.db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.info('Password reset successful', {
      userId: user.id,
      mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
    });

    return {
      success: true,
      message:
        'Password reset successful. You can now login with your new password.',
    };
  }

  async refreshToken(
    input: RefreshTokenInput
  ): Promise<{ tokens: AuthTokens }> {
    let decoded: { userId: string; role: RoleName; walletId: string };

    try {
      decoded = jwt.verify(
        input.refreshToken,
        env.JWT_REFRESH_SECRET
      ) as typeof decoded;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await this.db.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true, wallet: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User not found or inactive');
    }

    const tokens = this.generateTokens({
      userId: user.id,
      role: user.role.name,
      walletId: user.wallet?.id || decoded.walletId,
    });

    return { tokens };
  }

  async getProfile(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('User ID not provided');
    }
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { role: true, wallet: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    let balance = 0;
    if (user.wallet) {
      const creditSum = await this.db.walletTransaction.aggregate({
        where: {
          walletId: user.wallet.id,
          status: 'COMPLETED',
          type: 'CREDIT',
        },
        _sum: { amount: true },
      });

      const debitSum = await this.db.walletTransaction.aggregate({
        where: {
          walletId: user.wallet.id,
          status: 'COMPLETED',
          type: 'DEBIT',
        },
        _sum: { amount: true },
      });

      const credits = creditSum._sum.amount
        ? parseFloat(creditSum._sum.amount.toString())
        : 0;
      const debits = debitSum._sum.amount
        ? parseFloat(debitSum._sum.amount.toString())
        : 0;

      balance = parseFloat((credits - debits).toFixed(2));
    }

    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      isVerified: user.isVerified,
      status: user.status,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            balance,
            status: user.wallet.status,
          }
        : null,
      createdAt: user.createdAt,
    };
  }

  private generateTokens(payload: {
    userId: string;
    role: RoleName;
    walletId: string;
  }): AuthTokens {
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
    };
  }
}
