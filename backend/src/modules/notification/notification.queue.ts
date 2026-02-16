import { getNotificationService } from './notification.service';

export class NotificationQueue {}

export function notifyServicePurchased(userId: string, serviceName: string): void {
  void getNotificationService().sendTemplatedNotification(userId, 'SERVICE_PURCHASED', {
    serviceName,
  });
}

export function notifyServiceCompleted(userId: string, serviceName: string): void {
  void getNotificationService().sendTemplatedNotification(userId, 'SERVICE_COMPLETED', {
    serviceName,
  });
}

export function notifyServiceFailed(userId: string, serviceName: string, reason?: string): void {
  void getNotificationService().sendTemplatedNotification(userId, 'SERVICE_FAILED', {
    serviceName,
    reason,
  });
}

export function notifyRefundProcessed(userId: string, amount: number, _balanceAfter?: number): void {
  void getNotificationService().sendTemplatedNotification(userId, 'REFUND_PROCESSED', {
    amount,
  });
}
