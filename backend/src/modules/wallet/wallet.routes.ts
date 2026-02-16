import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireUser, requireAdmin } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validation.middleware';
import {
  addBalanceRequestSchema,
  approveBalanceRequestSchema,
  rejectBalanceRequestSchema,
  adjustmentSchema,
  transactionHistorySchema,
  freezeWalletSchema,
} from './wallet.validators';

const router = Router();
const controller = new WalletController();

// All wallet routes require authentication
router.use(authMiddleware);

// ═══════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════

router.get(
  '/balance',
  requireUser(),
  controller.getMyBalance.bind(controller)
);

router.get(
  '/transactions',
  requireUser(),
  validateQuery(transactionHistorySchema),
  controller.getMyTransactions.bind(controller)
);

router.get(
  '/summary',
  requireUser(),
  controller.getMyWalletSummary.bind(controller)
);

router.post(
  '/add-balance',
  requireUser(),
  validateBody(addBalanceRequestSchema),
  controller.requestAddBalance.bind(controller)
);

router.get(
  '/add-balance/instructions',
  requireUser(),
  controller.getAddBalanceInstructions.bind(controller)
);

router.get(
  '/balance-requests',
  requireUser(),
  controller.getMyBalanceRequests.bind(controller)
);

// ═══════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════

router.post(
  '/admin/approve-balance',
  requireAdmin(),
  validateBody(approveBalanceRequestSchema),
  controller.approveBalanceRequest.bind(controller)
);

router.post(
  '/admin/reject-balance',
  requireAdmin(),
  validateBody(rejectBalanceRequestSchema),
  controller.rejectBalanceRequest.bind(controller)
);

router.get(
  '/admin/balance-requests',
  requireAdmin(),
  controller.getAllBalanceRequests.bind(controller)
);

router.post(
  '/admin/adjustment',
  requireAdmin(),
  validateBody(adjustmentSchema),
  controller.walletAdjustment.bind(controller)
);

router.post(
  '/admin/freeze',
  requireAdmin(),
  validateBody(freezeWalletSchema),
  controller.freezeWallet.bind(controller)
);

router.post(
  '/admin/unfreeze',
  requireAdmin(),
  validateBody(freezeWalletSchema),
  controller.unfreezeWallet.bind(controller)
);

router.get(
  '/admin/transactions',
  requireAdmin(),
  validateQuery(transactionHistorySchema),
  controller.getAllTransactions.bind(controller)
);

router.get(
  '/admin/:walletId/balance',
  requireAdmin(),
  controller.getWalletBalance.bind(controller)
);

router.get(
  '/admin/:walletId/transactions',
  requireAdmin(),
  controller.getWalletTransactions.bind(controller)
);

router.get(
  '/admin/:walletId/summary',
  requireAdmin(),
  controller.getWalletSummaryAdmin.bind(controller)
);

export { router as walletRoutes };
