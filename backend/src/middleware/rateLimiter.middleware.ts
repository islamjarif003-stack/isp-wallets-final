import rateLimit from 'express-rate-limit';
import { getRedis, isRedisAvailable } from '../config/redis';
import { env } from '../config/env';
import { APP_CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';

function normalizeIp(ip: string): string {
  const v = (ip || '').trim();
  if (v.startsWith('::ffff:')) return v.slice('::ffff:'.length);
  return v;
}

function isPrivateIp(ip: string): boolean {
  const v = normalizeIp(ip);
  if (!v) return false;
  if (v === '::1' || v === '127.0.0.1') return true;
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  if (v.startsWith('172.')) {
    const parts = v.split('.');
    const second = parts.length > 1 ? Number(parts[1]) : NaN;
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  return false;
}

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.isDevelopment() ? Math.max(env.RATE_LIMIT_MAX, 5000) : env.RATE_LIMIT_MAX,
  skip: (req) => env.isDevelopment() && isPrivateIp(String((req as any).ip || '')),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimiterMiddleware = generalRateLimiter;

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isDevelopment() ? 500 : 10,
  skip: (req) => env.isDevelopment() && isPrivateIp(String((req as any).ip || '')),
  message: {
    success: false,
    message:
      'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpRateLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.isDevelopment() ? Math.max(env.OTP_RATE_LIMIT_MAX, 100) : env.OTP_RATE_LIMIT_MAX,
  skip: (req) => env.isDevelopment() && isPrivateIp(String((req as any).ip || '')),
  message: {
    success: false,
    message: 'Too many OTP requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const mobile = req.body?.mobile ? String(req.body.mobile) : '';
    return `otp:${mobile || 'unknown'}`;
  },
});

export async function checkRedisRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (!isRedisAvailable()) {
    return { allowed: true, remaining: maxAttempts, resetIn: 0 };
  }

  const redis = getRedis();
  const redisKey = APP_CONSTANTS.REDIS_KEYS.RATE_LIMIT(key);

  try {
    const current = await redis.incr(redisKey);

    if (current === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    const ttl = await redis.ttl(redisKey);
    const remaining = Math.max(0, maxAttempts - current);

    return {
      allowed: current <= maxAttempts,
      remaining,
      resetIn: ttl,
    };
  } catch (error) {
    logger.error('Redis rate limit check failed', { key, error });
    return { allowed: true, remaining: maxAttempts, resetIn: 0 };
  }
}
