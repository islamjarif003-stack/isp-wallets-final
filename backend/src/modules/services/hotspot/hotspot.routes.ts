import { Router } from 'express';
import { HotspotController } from './hotspot.controller';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { requireAdmin, requireUser } from '../../../middleware/rbac.middleware';
import { validateBody } from '../../../middleware/validation.middleware';
import { addHotspotCardsSchema, purchaseHotspotSchema } from './hotspot.validators';

const router = Router();
const controller = new HotspotController();

// Public routes
router.get(
  '/stock/:packageId',
  controller.getStock.bind(controller)
);

// All subsequent routes are authenticated
router.use(authMiddleware);

// ═══════════════════════════════════════════════
// ADMIN (ADMIN & SUPER_ADMIN)
// ═══════════════════════════════════════════════

router.post(
  '/admin/cards',
  requireAdmin(),
  validateBody(addHotspotCardsSchema),
  controller.addCards.bind(controller)
);

router.get(
  '/admin/stats',
  requireAdmin(),
  controller.getCardStats.bind(controller)
);

router.get(
  '/admin/used-cards',
  requireAdmin(),
  controller.getUsedCards.bind(controller)
);

router.get(
  '/admin/available-cards',
  requireAdmin(),
  controller.getAvailableCards.bind(controller)
);

router.put(
  '/admin/cards/:cardId',
  requireAdmin(),
  controller.updateCard.bind(controller)
);

router.delete(
  '/admin/cards/:cardId',
  requireAdmin(),
  controller.deleteCard.bind(controller)
);

router.post(
  '/admin/cards/delete-all',
  requireAdmin(),
  controller.deleteAllAvailableCards.bind(controller)
);

router.post(
  '/admin/cards/:cardId/reset',
  requireAdmin(),
  controller.resetCard.bind(controller)
);

// ═══════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════

router.post(
  '/purchase',
  requireUser(),
  validateBody(purchaseHotspotSchema),
  controller.purchaseHotspot.bind(controller)
);

export default router;
