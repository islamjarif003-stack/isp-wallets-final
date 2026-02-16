import { OtpType } from '@prisma/account-wallet-client';

export interface SendOtpInput {
  mobile: string;
  type: OtpType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyOtpInput {
  mobile: string;
  otp: string;
  type: OtpType;
}

export interface OtpResult {
  success: boolean;
  message: string;
  otpRequestId?: string;
}