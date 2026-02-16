import { z } from 'zod';

const mobileRegex = /^01[3-9]\d{8}$/;

export const signupRequestOtpSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, 'Invalid Bangladesh mobile number'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
});

export const signupCompleteSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, 'Invalid Bangladesh mobile number'),
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must not exceed 128 characters'),
  email: z.string().email('Invalid email format').optional().nullable(),
});

export const loginSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, 'Invalid Bangladesh mobile number'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordRequestSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, 'Invalid Bangladesh mobile number'),
});

export const forgotPasswordResetSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, 'Invalid Bangladesh mobile number'),
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
  newPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});