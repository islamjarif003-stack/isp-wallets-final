import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireUser } from '../../middleware/rbac.middleware';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);
router.use(requireUser());

router.get('/', controller.getMyNotifications.bind(controller));
router.get('/unread-count', controller.getUnreadCount.bind(controller));
router.patch('/:notificationId/read', controller.markAsRead.bind(controller));
router.patch('/read-all', controller.markAllAsRead.bind(controller));

export { router as notificationRoutes };