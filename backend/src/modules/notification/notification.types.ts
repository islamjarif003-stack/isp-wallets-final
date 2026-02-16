export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
}

export type NotificationType =
  | 'SERVICE_PURCHASED'
  | 'SERVICE_COMPLETED'
  | 'SERVICE_FAILED'
  | 'REFUND_PROCESSED'
  | 'BALANCE_ADD_REQUESTED'
  | 'BALANCE_ADD_APPROVED'
  | 'BALANCE_ADD_REJECTED'
  | 'SYSTEM';

export type NotificationPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
};

export type SmsPayload = {
  mobile: string;
  message: string;
};
