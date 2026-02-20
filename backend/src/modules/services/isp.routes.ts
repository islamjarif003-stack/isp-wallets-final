import { Router } from 'express';
import { authMiddleware as auth } from '../../middleware/auth.middleware';
import { requireRoles as rbac } from '../../middleware/rbac.middleware';
import { RoleName as Role } from '@prisma/account-wallet-client';
import { IspController } from './isp.controller';

const router = Router();
const ispController = new IspController();

// Get all ISP execution logs
router.get(
  '/logs',
  auth,
  rbac([Role.ADMIN, Role.SUPPORT]),
  ispController.getIspLogs
);

// Retry a specific ISP job
router.post(
  '/logs/:logId/retry',
  auth,
  rbac([Role.ADMIN]),
  ispController.retryIspJob
);

export const ispRoutes = router;
