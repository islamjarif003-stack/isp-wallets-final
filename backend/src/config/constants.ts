// Application Constants
export const constants = {
  OTP_LENGTH: 6,
  OTP_EXPIRY: 5 * 60, // 5 minutes
  MAX_OTP_ATTEMPTS: 3,
  SESSION_TIMEOUT: 24 * 60 * 60, // 24 hours
};

export const APP_CONSTANTS = {
  WALLET: {
    MIN_ADD_BALANCE: 10,
    MAX_ADD_BALANCE: 100000,
    MAX_SINGLE_TRANSACTION: 500000,
  },
  OTP: {
    RESEND_COOLDOWN_SECONDS: 60,
  },
  REDIS_KEYS: {
    RATE_LIMIT: (key: string) => `rate_limit:${key}`,
    OTP_COOLDOWN: (mobile: string) => `otp_cooldown:${mobile}`,
    SYSTEM_SETTINGS: 'system_settings',
  },
} as const;
