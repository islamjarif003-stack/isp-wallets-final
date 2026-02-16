import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  authRateLimiter,
  otpRateLimiter,
} from '../../middleware/rateLimiter.middleware';
import {
  signupRequestOtpSchema,
  signupCompleteSchema,
  loginSchema,
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  refreshTokenSchema,
} from './auth.validators';

const router = Router();
const controller = new AuthController();

// Public routes
router.post(
  '/signup/request-otp',
  otpRateLimiter,
  validateBody(signupRequestOtpSchema),
  controller.signupRequestOtp.bind(controller)
);

router.post(
  '/signup/complete',
  authRateLimiter,
  validateBody(signupCompleteSchema),
  controller.signupComplete.bind(controller)
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  controller.login.bind(controller)
);

router.post(
  '/forgot-password/request',
  otpRateLimiter,
  validateBody(forgotPasswordRequestSchema),
  controller.forgotPasswordRequest.bind(controller)
);

router.post(
  '/forgot-password/reset',
  authRateLimiter,
  validateBody(forgotPasswordResetSchema),
  controller.forgotPasswordReset.bind(controller)
);

router.post(
  '/refresh-token',
  validateBody(refreshTokenSchema),
  controller.refreshToken.bind(controller)
);

// Protected routes
router.get('/profile', authMiddleware, controller.getProfile.bind(controller));

export { router as authRoutes };