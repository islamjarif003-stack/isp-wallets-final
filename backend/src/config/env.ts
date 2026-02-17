import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

function readString(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v;
}

function readNumber(name: string, fallback: number): number {
  const raw = readString(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = readString(name);
  if (!raw) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function readNodeEnv(): NodeEnv {
  const raw = (readString('NODE_ENV', 'development') || 'development').toLowerCase();
  if (raw === 'production' || raw === 'test' || raw === 'development') return raw;
  return 'development';
}

const nodeEnv = readNodeEnv();

export const env = {
  NODE_ENV: nodeEnv,
  HOST: readString('HOST', '0.0.0.0') || '0.0.0.0',
  PORT: readNumber('PORT', 3000),

  API_VERSION: readString('API_VERSION', 'v1') || 'v1',

  ACCOUNT_WALLET_DATABASE_URL:
    readString('ACCOUNT_WALLET_DATABASE_URL') || readString('DATABASE_URL'),
  SERVICE_DATABASE_URL: readString('SERVICE_DATABASE_URL'),

  REDIS_URL: readString('REDIS_URL'),
  REDIS_HOST: readString('REDIS_HOST', '127.0.0.1') || '127.0.0.1',
  REDIS_PORT: readNumber('REDIS_PORT', 6379),
  REDIS_PASSWORD: readString('REDIS_PASSWORD'),
  REDIS_DB: readNumber('REDIS_DB', 0),
  REDIS_ENABLED: readBoolean('REDIS_ENABLED', true),

  JWT_ACCESS_SECRET:
    readString('JWT_ACCESS_SECRET') || readString('JWT_SECRET') || '',
  JWT_REFRESH_SECRET: readString('JWT_REFRESH_SECRET') || '',
  JWT_ACCESS_EXPIRY: readString('JWT_ACCESS_EXPIRY', '15m') || '15m',
  JWT_REFRESH_EXPIRY: readString('JWT_REFRESH_EXPIRY', '7d') || '7d',

  OTP_EXPIRY_MINUTES: readNumber('OTP_EXPIRY_MINUTES', 3),
  OTP_MAX_ATTEMPTS: readNumber('OTP_MAX_ATTEMPTS', 5),
  OTP_RATE_LIMIT_WINDOW_MINUTES: readNumber('OTP_RATE_LIMIT_WINDOW_MINUTES', 10),
  OTP_RATE_LIMIT_MAX: readNumber('OTP_RATE_LIMIT_MAX', 3),
  OTP_LENGTH: readNumber('OTP_LENGTH', 6),

  SMS_GATEWAY_URL: readString('SMS_GATEWAY_URL'),
  SMS_GATEWAY_API_KEY: readString('SMS_GATEWAY_API_KEY'),
  SMS_GATEWAY_SENDER_ID: readString('SMS_GATEWAY_SENDER_ID'),

  CORS_ORIGIN_USER: readString('CORS_ORIGIN_USER', 'http://localhost:3000') || 'http://localhost:3000',
  CORS_ORIGIN_ADMIN: readString('CORS_ORIGIN_ADMIN', 'http://localhost:3002') || 'http://localhost:3002',

  RATE_LIMIT_WINDOW_MS: readNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  RATE_LIMIT_MAX: readNumber('RATE_LIMIT_MAX', 100),

  LOCK_TTL_MS: readNumber('LOCK_TTL_MS', 30_000),
  LOCK_RETRY_DELAY_MS: readNumber('LOCK_RETRY_DELAY_MS', 200),
  LOCK_RETRY_COUNT: readNumber('LOCK_RETRY_COUNT', 10),

  EXCEL_LEGACY_PATH: readString('EXCEL_LEGACY_PATH', './data/legacy-packages.xlsx') || './data/legacy-packages.xlsx',

  LOG_LEVEL: readString('LOG_LEVEL', 'info') || 'info',

  isProduction(): boolean {
    return nodeEnv === 'production';
  },

  isDevelopment(): boolean {
    return nodeEnv === 'development';
  },
} as const;

export const envConfig = env;

export const NODE_ENV = env.NODE_ENV;
export const PORT = env.PORT;
export const API_VERSION = env.API_VERSION;
export const ACCOUNT_WALLET_DATABASE_URL = env.ACCOUNT_WALLET_DATABASE_URL;
export const SERVICE_DATABASE_URL = env.SERVICE_DATABASE_URL;
export const REDIS_URL = env.REDIS_URL;
export const REDIS_HOST = env.REDIS_HOST;
export const REDIS_PORT = env.REDIS_PORT;
export const REDIS_PASSWORD = env.REDIS_PASSWORD;
export const REDIS_DB = env.REDIS_DB;
export const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
export const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
export const JWT_ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY;
export const JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY;
export const OTP_EXPIRY_MINUTES = env.OTP_EXPIRY_MINUTES;
export const OTP_MAX_ATTEMPTS = env.OTP_MAX_ATTEMPTS;
export const OTP_RATE_LIMIT_WINDOW_MINUTES = env.OTP_RATE_LIMIT_WINDOW_MINUTES;
export const OTP_RATE_LIMIT_MAX = env.OTP_RATE_LIMIT_MAX;
export const OTP_LENGTH = env.OTP_LENGTH;
export const SMS_GATEWAY_URL = env.SMS_GATEWAY_URL;
export const SMS_GATEWAY_API_KEY = env.SMS_GATEWAY_API_KEY;
export const SMS_GATEWAY_SENDER_ID = env.SMS_GATEWAY_SENDER_ID;
export const CORS_ORIGIN_USER = env.CORS_ORIGIN_USER;
export const CORS_ORIGIN_ADMIN = env.CORS_ORIGIN_ADMIN;
export const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
export const RATE_LIMIT_MAX = env.RATE_LIMIT_MAX;
export const LOCK_TTL_MS = env.LOCK_TTL_MS;
export const LOCK_RETRY_DELAY_MS = env.LOCK_RETRY_DELAY_MS;
export const LOCK_RETRY_COUNT = env.LOCK_RETRY_COUNT;
export const EXCEL_LEGACY_PATH = env.EXCEL_LEGACY_PATH;
export const LOG_LEVEL = env.LOG_LEVEL;
