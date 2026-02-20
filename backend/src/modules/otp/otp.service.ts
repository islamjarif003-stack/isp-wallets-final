import bcrypt from 'bcrypt';
import { getAccountWalletDb } from '../../config/database';
import { redisConnection } from '../../config/redis';
import { env } from '../../config/env';
import { APP_CONSTANTS } from '../../config/constants';
import { getLogger } from '../../utils/logger';
import { generateOtp } from '../../utils/helpers';
import { checkRedisRateLimit } from '../../middleware/rateLimiter.middleware';
import { SendOtpInput, VerifyOtpInput, OtpResult } from './otp.types';
import { AppError, TooManyRequestsError, ConflictError } from '../../utils/errors';
import { OtpType } from '@prisma/account-wallet-client';

export class OtpService {
  private db = getAccountWalletDb();
  private logger = getLogger();

  async sendOtp(input: SendOtpInput): Promise<OtpResult> {
    const { mobile, type, userId, ipAddress, userAgent } = input;

    const rateKey = `otp:${mobile}:${type}`;
    const rateCheck = await checkRedisRateLimit(
      rateKey,
      env.OTP_RATE_LIMIT_MAX,
      env.OTP_RATE_LIMIT_WINDOW_MINUTES * 60
    );

    if (!rateCheck.allowed) {
      throw new TooManyRequestsError(
        `Too many OTP requests. Try again in ${rateCheck.resetIn} seconds.`
      );
    }

    if (env.REDIS_ENABLED) {
      const redis = redisConnection;
      const cooldownKey = APP_CONSTANTS.REDIS_KEYS.OTP_COOLDOWN(mobile);
      const cooldownExists = await redis.exists(cooldownKey);
      if (cooldownExists) {
        const ttl = await redis.ttl(cooldownKey);
        throw new ConflictError(
          `Please wait ${ttl} seconds before requesting another OTP`
        );
      }
    }

    await this.db.otpRequest.updateMany({
      where: { mobile, type, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    const otpPlain = generateOtp(env.OTP_LENGTH);
    const otpHash = await bcrypt.hash(otpPlain, 10);

    const expiresAt = new Date(
      Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000
    );

    const otpRequest = await this.db.otpRequest.create({
      data: {
        userId: userId || null,
        mobile,
        otpHash,
        type,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: env.OTP_MAX_ATTEMPTS,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    if (env.REDIS_ENABLED) {
      const redis = redisConnection;
      const cooldownKey = APP_CONSTANTS.REDIS_KEYS.OTP_COOLDOWN(mobile);
      await redis.setex(
        cooldownKey,
        APP_CONSTANTS.OTP.RESEND_COOLDOWN_SECONDS,
        '1'
      );
    }

    await this.sendSms(mobile, type, otpPlain);

    this.logger.info('OTP sent successfully', {
      mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
      type,
      otpRequestId: otpRequest.id,
    });

    const result: OtpResult = {
      success: true,
      message: 'OTP sent successfully',
      otpRequestId: otpRequest.id,
    };

    return result;
  }

  async verifyOtp(input: VerifyOtpInput): Promise<OtpResult> {
    const { mobile, otp, type } = input;

    const otpRequest = await this.db.otpRequest.findFirst({
      where: { mobile, type, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRequest) {
      throw new AppError(
        'No pending OTP found. Please request a new one.',
        400
      );
    }

    if (new Date() > otpRequest.expiresAt) {
      await this.db.otpRequest.update({
        where: { id: otpRequest.id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    if (otpRequest.attempts >= otpRequest.maxAttempts) {
      await this.db.otpRequest.update({
        where: { id: otpRequest.id },
        data: { status: 'BLOCKED' },
      });
      throw new AppError(
        'Maximum OTP attempts exceeded. Please request a new one.',
        400
      );
    }

    const isValid = await bcrypt.compare(otp, otpRequest.otpHash);

    if (!isValid) {
      await this.db.otpRequest.update({
        where: { id: otpRequest.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining =
        otpRequest.maxAttempts - (otpRequest.attempts + 1);
      throw new AppError(
        `Invalid OTP. ${remaining} attempt(s) remaining.`,
        400
      );
    }

    await this.db.otpRequest.update({
      where: { id: otpRequest.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    this.logger.info('OTP verified successfully', {
      mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
      type,
      otpRequestId: otpRequest.id,
    });

    return {
      success: true,
      message: 'OTP verified successfully',
      otpRequestId: otpRequest.id,
    };
  }

  async isOtpVerified(mobile: string, type: OtpType): Promise<boolean> {
    const verifiedOtp = await this.db.otpRequest.findFirst({
      where: {
        mobile,
        type,
        status: 'VERIFIED',
        verifiedAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
      orderBy: { verifiedAt: 'desc' },
    });

    return !!verifiedOtp;
  }

  private async sendSms(
    mobile: string,
    type: OtpType,
    otp: string
  ): Promise<void> {
    const settings = await this.getSystemSettings();
    const enabled = String(settings.sms_enabled || 'false').toLowerCase() === 'true';
    const smsUrl = settings.sms_api_url || '';
    const smsApiKey = settings.sms_api_key || '';
    const senderId = settings.sms_sender_id || '';
    const expiryMinutes = String(env.OTP_EXPIRY_MINUTES);

    if (!enabled) {
      this.logger.info('SMS sending disabled by settings. OTP not sent.', {
        mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        type,
      });
      return;
    }

    const templateKey =
      type === 'SIGNUP_VERIFICATION'
        ? 'sms_template_signup_otp'
        : 'sms_template_forgot_password_otp';

    const template = settings[templateKey] || '';
    if (!template) {
      this.logger.warn('SMS template missing. OTP not sent.', {
        mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        type,
        templateKey,
      });
      return;
    }

    const message = template
      .replace(/\{\{\s*otp\s*\}\}/g, otp)
      .replace(/\{\{\s*expiryMinutes\s*\}\}/g, expiryMinutes);

    if (!smsUrl || !smsApiKey || !senderId) {
      this.logger.warn('SMS gateway settings missing. OTP not sent.', {
        mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        type,
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const isBulkSmsDhaka =
        smsUrl.toLowerCase().includes('bulksmsdhaka.net') ||
        smsUrl.toLowerCase().includes('/api/otpsend') ||
        smsUrl.toLowerCase().includes('otpsend');

      const response = isBulkSmsDhaka
        ? await fetch(this.buildBulkSmsDhakaUrl(smsUrl, smsApiKey, senderId, mobile, message), {
            method: 'GET',
            headers: { Accept: 'application/json, text/plain, */*' },
            signal: controller.signal,
          })
        : await fetch(smsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${smsApiKey}`,
              'x-api-key': smsApiKey,
            },
            body: JSON.stringify({
              to: mobile,
              message,
              sender_id: senderId,
            }),
            signal: controller.signal,
          });

      clearTimeout(timeout);

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        this.logger.error('SMS gateway returned error', {
          status: response.status,
          contentType,
          mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        });
      } else {
        this.logger.info('SMS sent successfully', {
          mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        });
      }
    } catch (error) {
      this.logger.error('SMS sending failed', {
        mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private buildBulkSmsDhakaUrl(
    smsUrl: string,
    apiKey: string,
    senderId: string,
    number: string,
    message: string
  ): string {
    const url = new URL(smsUrl);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('callerID', senderId);
    url.searchParams.set('number', number);
    url.searchParams.set('message', message);
    return url.toString();
  }

  private async getSystemSettings(): Promise<Record<string, string>> {
    const key = APP_CONSTANTS.REDIS_KEYS.SYSTEM_SETTINGS;

    if (env.REDIS_ENABLED) {
      try {
        const redis = redisConnection;
        const cached = await redis.get(key);
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, string>;
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {}
    }

    const rows = await this.db.systemSetting.findMany({
      select: { key: true, value: true },
    });
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    if (env.REDIS_ENABLED) {
      try {
        const redis = redisConnection;
        await redis.setex(key, 300, JSON.stringify(settings));
      } catch {}
    }

    return settings;
  }
}
