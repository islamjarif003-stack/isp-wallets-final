import { Router } from 'express';
import { authMiddleware as auth } from '../../middleware/auth.middleware';
import { requireRoles as rbac } from '../../middleware/rbac.middleware';
import { RoleName as Role } from '@prisma/account-wallet-client';
import { ServiceController } from './service.controller';
import { IspController } from './isp.controller';

const router = Router();
const serviceController = new ServiceController();
const ispController = new IspController();

// Get all execution logs (renamed from ISP logs for clarity)
router.get(
  '/logs',
  auth,
  rbac(Role.ADMIN, Role.SUPER_ADMIN),
  ispController.getIspLogs
);

// Retry a specific ISP job
router.post(
  '/logs/:logId/retry',
  auth,
  rbac(Role.ADMIN),
  ispController.retryIspJob
);

export const ispRoutes = router;
