import { Router } from 'express';
import { ReportingController } from './reporting.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validateQuery } from '../../middleware/validation.middleware';
import { reportQuerySchema } from '../admin/admin.validators';

const router = Router();
const controller = new ReportingController();

router.use(authMiddleware);
router.use(requireAdmin());

router.get('/revenue', controller.getRevenueReport.bind(controller));
router.get('/inflow-outflow', controller.getInflowOutflow.bind(controller));
router.get('/commission', controller.getCommissionReport.bind(controller));
router.get('/services', controller.getServiceReport.bind(controller));
router.get('/top-users', controller.getTopUsers.bind(controller));

router.get('/export/transactions', controller.exportTransactions.bind(controller));
router.get('/export/users', controller.exportUsers.bind(controller));
router.get('/export/service-logs', controller.exportServiceLogs.bind(controller));
router.get('/export/revenue', controller.exportRevenueReport.bind(controller));

export { router as reportingRoutes };