import { Router } from 'express';
import { ServiceController } from './service.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireUser, requireAdmin } from '../../middleware/rbac.middleware';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import {
  createPackageSchema,
  updatePackageSchema,
  purchaseHomeInternetSchema,
  purchaseMobileRechargeSchema,
  purchaseElectricitySchema,
  packageIdParamSchema,
} from './service.validators';
import stbRouter from './set-top-box/stb.routes';
import hotspotRouter from './hotspot/hotspot.routes';
import { z } from 'zod';

const router = Router();
const controller = new ServiceController();

// ═══════════════════════════════════════════════
// PUBLIC: Package listing (still needs auth)
// ═══════════════════════════════════════════════

router.use(authMiddleware);

router.get(
  '/packages',
  requireUser(),
  controller.getPackages.bind(controller)
);

router.get(
  '/packages/:packageId',
  requireUser(),
  validateParams(packageIdParamSchema),
  controller.getPackageById.bind(controller)
);

// ═══════════════════════════════════════════════
// USER: Purchase services
// ═══════════════════════════════════════════════

router.post(
  '/purchase/home-internet',
  requireUser(),
  validateBody(purchaseHomeInternetSchema),
  controller.purchaseHomeInternet.bind(controller)
);

// Hotspot moved to sub-router
// router.post('/purchase/hotspot', ...)

router.post(
  '/purchase/mobile-recharge',
  requireUser(),
  validateBody(purchaseMobileRechargeSchema),
  controller.purchaseMobileRecharge.bind(controller)
);

router.post(
  '/purchase/electricity',
  requireUser(),
  validateBody(purchaseElectricitySchema),
  controller.purchaseElectricityBill.bind(controller)
);

// ═══════════════════════════════════════════════
// USER: Service history
// ═══════════════════════════════════════════════

router.get(
  '/history',
  requireUser(),
  controller.getMyServiceHistory.bind(controller)
);

router.get(
  '/my/home-services',
  requireUser(),
  controller.getMyHomeServices.bind(controller)
);

router.get(
  '/my/hotspot-services',
  requireUser(),
  controller.getMyHotspotServices.bind(controller)
);

router.get(
  '/my/recharges',
  requireUser(),
  controller.getMyRechargeHistory.bind(controller)
);

router.get(
  '/my/electricity-bills',
  requireUser(),
  controller.getMyElectricityHistory.bind(controller)
);

// ═══════════════════════════════════════════════
// ADMIN: Package management
// ═══════════════════════════════════════════════

router.get(
  '/admin/packages',
  requireAdmin(),
  controller.getPackagesAdmin.bind(controller)
);

router.post(
  '/admin/packages',
  requireAdmin(),
  validateBody(createPackageSchema),
  controller.createPackage.bind(controller)
);

router.put(
  '/admin/packages/:packageId',
  requireAdmin(),
  validateParams(packageIdParamSchema),
  validateBody(updatePackageSchema),
  controller.updatePackage.bind(controller)
);

// ═══════════════════════════════════════════════
// ADMIN: Execution management
// ═══════════════════════════════════════════════

router.get(
  '/admin/pending',
  requireAdmin(),
  controller.getPendingServices.bind(controller)
);

router.get(
  '/admin/execution-logs',
  requireAdmin(),
  controller.getAllExecutionLogs.bind(controller)
);

router.post(
  '/admin/manual-execute/:executionLogId',
  requireAdmin(),
  validateParams(z.object({ executionLogId: z.string().uuid() })),
  controller.adminManualExecute.bind(controller)
);

router.post(
  '/admin/manual-refund/:executionLogId',
  requireAdmin(),
  validateParams(z.object({ executionLogId: z.string().uuid() })),
  validateBody(z.object({ reason: z.string().trim().min(5).max(500) })),
  controller.adminManualRefund.bind(controller)
);

router.post(
  '/admin/services/release-home-connection',
  requireAdmin(),
  validateBody(z.object({
    connectionId: z.union([z.string(), z.number()]).transform((val) => String(val).trim())
  })),
  controller.adminReleaseHomeConnectionOwnership.bind(controller)
);

// ═══════════════════════════════════════════════
// SUB-MODULES
// ═══════════════════════════════════════════════

router.use('/stb', stbRouter);
router.use('/hotspot', hotspotRouter);

export { router as serviceRoutes };
