import { Router } from 'express';
import { StbController } from './stb.controller';
import { requireSuperAdmin, requireUser, requireAdmin } from '../../../middleware/rbac.middleware';
import { validateBody } from '../../../middleware/validation.middleware';
import { createStbPackageSchema, purchaseStbSchema, updateStbPackageStatusSchema, updateStbPackageSchema } from './stb.validators';
import { z } from 'zod';

const router = Router();
const controller = new StbController();

// ═══════════════════════════════════════════════
// PUBLIC (Authenticated)
// ═══════════════════════════════════════════════

router.get(
  '/packages',
  controller.getPackages.bind(controller)
);

// ═══════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════

router.post(
  '/purchase',
  requireUser(),
  validateBody(purchaseStbSchema),
  controller.purchaseStbService.bind(controller)
);

router.get(
  '/my-services',
  requireUser(),
  controller.getMyStbServices.bind(controller)
);

// ═══════════════════════════════════════════════
// ADMIN (SUPER_ADMIN ONLY as per request)
// ═══════════════════════════════════════════════

router.post(
  '/admin/packages',
  requireSuperAdmin(),
  validateBody(createStbPackageSchema),
  controller.createPackage.bind(controller)
);

router.put(
  '/admin/packages/:packageId',
  requireSuperAdmin(),
  validateBody(updateStbPackageSchema),
  controller.updatePackage.bind(controller)
);

router.put(
  '/admin/packages/:packageId/status',
  requireSuperAdmin(),
  validateBody(updateStbPackageStatusSchema),
  controller.updatePackageStatus.bind(controller)
);

router.post(
  '/admin/release-owner',
  requireAdmin(),
  validateBody(z.object({
    stbNumber: z.string().min(1)
  })),
  controller.adminReleaseStbOwnership.bind(controller)
);

export default router;
