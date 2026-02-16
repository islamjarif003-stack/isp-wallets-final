import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validation.middleware';
import {
  updateUserStatusSchema,
  assignRoleSchema,
  updateSettingSchema,
  userListQuerySchema,
  auditLogQuerySchema,
  resetUserPasswordSchema,
} from './admin.validators';
import { z } from 'zod';

const router = Router();
const controller = new AdminController();

router.use(authMiddleware);
router.use(requireAdmin());

router.get('/dashboard', controller.getDashboard.bind(controller));

router.get('/users', validateQuery(userListQuerySchema), controller.getUsers.bind(controller));
router.get('/users/:userId', controller.getUserDetail.bind(controller));
router.post('/users/status', validateBody(updateUserStatusSchema), controller.updateUserStatus.bind(controller));
router.post('/users/role', requireSuperAdmin(), validateBody(assignRoleSchema), controller.assignRole.bind(controller));
router.post('/users/reset-password', requireSuperAdmin(), validateBody(resetUserPasswordSchema), controller.resetUserPassword.bind(controller));

router.get('/settings', controller.getSettings.bind(controller));
router.put('/settings', validateBody(updateSettingSchema), controller.updateSetting.bind(controller));

router.get('/audit-logs', validateQuery(auditLogQuerySchema), controller.getAuditLogs.bind(controller));
router.get('/roles', controller.getRoles.bind(controller));

export { router as adminRoutes };