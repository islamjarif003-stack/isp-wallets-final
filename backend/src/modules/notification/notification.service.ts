import { getAccountWalletDb } from '../../config/database';
import { getLogger } from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { env } from '../../config/env';
import { NotificationPayload, NotificationType, SmsPayload } from './notification.types';
import { getTemplate } from './notification.templates';
import { paginationMeta } from '../../utils/helpers';

export class NotificationService {
  private db = getAccountWalletDb();
  private logger = getLogger();
  private smsQueue: SmsPayload[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startQueueProcessor();
  }

  // ─── Send in-app notification ────────────────────────
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      await this.db.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          isRead: false,
          metadata: payload.metadata,
        },
      });

      this.logger.info('Notification created', {
        userId: payload.userId,
        type: payload.type,
      });
    } catch (error) {
      // Non-blocking - notification failure should not crash
      this.logger.error('Failed to create notification', {
        userId: payload.userId,
        type: payload.type,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  // ─── Send notification using template ────────────────
  async sendTemplatedNotification(
    userId: string,
    type: NotificationType,
    data: Record<string, any>
  ): Promise<void> {
    const template = getTemplate(type, data);

    await this.sendNotification({
      userId,
      type,
      title: template.title,
      message: template.message,
      metadata: data,
    });
  }

  // ─── Queue SMS (non-OTP, non-blocking) ───────────────
  async queueSms(mobile: string, message: string): Promise<void> {
    this.smsQueue.push({ mobile, message });
    this.logger.debug('SMS queued', {
      mobile: mobile.slice(0, 3) + '****' + mobile.slice(-4),
    });
  }

  // ─── Process SMS queue ──────────────────────────────
  private startQueueProcessor(): void {
    this.processingInterval = setInterval(async () => {
      if (this.smsQueue.length === 0) return;

      const batch = this.smsQueue.splice(0, 10); // Process 10 at a time

      for (const sms of batch) {
        try {
          await this.sendSmsToGateway(sms);
        } catch (error) {
          this.logger.error('SMS queue processing failed', {
            mobile: sms.mobile.slice(0, 3) + '****' + sms.mobile.slice(-4),
            error: error instanceof Error ? error.message : error,
          });
        }
      }
    }, 5000); // Every 5 seconds
  }

  private async sendSmsToGateway(sms: SmsPayload): Promise<void> {
    let gatewayUrl = env.SMS_GATEWAY_URL;
    let gatewayApiKey = env.SMS_GATEWAY_API_KEY;
    let senderId = env.SMS_GATEWAY_SENDER_ID;

    // Try reading from DB if ENV is missing
    if (!gatewayUrl || !gatewayApiKey) {
      const settings = await this.db.systemSetting.findMany({
        where: { key: { in: ['sms_api_url', 'sms_api_key', 'sms_sender_id', 'sms_enabled'] } }
      });
      const map = new Map(settings.map(s => [s.key, s.value]));
      
      if (map.get('sms_enabled') === 'false') {
        this.logger.debug('SMS disabled in settings');
        return;
      }

      gatewayUrl = map.get('sms_api_url') as string | undefined;
      gatewayApiKey = map.get('sms_api_key') as string | undefined;
      senderId = map.get('sms_sender_id') as string | undefined;
    }

    if (!gatewayUrl || !gatewayApiKey) {
      this.logger.debug('SMS gateway not configured, skipping SMS send');
      return;
    }

    await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const isBulkSmsDhaka =
          gatewayUrl!.toLowerCase().includes('bulksmsdhaka.net') ||
          gatewayUrl!.toLowerCase().includes('/api/otpsend') ||
          gatewayUrl!.toLowerCase().includes('otpsend');

        let response;
        
        if (isBulkSmsDhaka) {
           const url = new URL(gatewayUrl!);
           url.searchParams.set('apikey', gatewayApiKey!);
           url.searchParams.set('callerID', senderId || '');
           url.searchParams.set('number', sms.mobile);
           url.searchParams.set('message', sms.message);
           
           response = await fetch(url.toString(), {
             method: 'GET',
             headers: { Accept: 'application/json, text/plain, */*' },
             signal: controller.signal,
           });
        } else {
           response = await fetch(gatewayUrl!, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               Authorization: `Bearer ${gatewayApiKey}`,
               'x-api-key': gatewayApiKey!,
             },
             body: JSON.stringify({
               to: sms.mobile,
               message: sms.message,
               sender_id: senderId,
             }),
             signal: controller.signal,
           });
        }

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`SMS gateway error: ${response.status}`);
        }
      },
      { maxAttempts: 3, delayMs: 2000, backoff: 'exponential' }
    );
  }

  // ─── Get user notifications ──────────────────────────
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.notification.count({ where: { userId } }),
      this.db.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      meta: paginationMeta(total, page, limit),
    };
  }

  // ─── Mark as read ────────────────────────────────────
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  // ─── Mark all as read ────────────────────────────────
  async markAllAsRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── Get unread count ────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    return this.db.notification.count({
      where: { userId, isRead: false },
    });
  }

  // ─── Cleanup ─────────────────────────────────────────
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

// Singleton
let notificationServiceInstance: NotificationService;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
