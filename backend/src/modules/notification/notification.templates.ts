import { NotificationType } from './notification.types';

export const notificationTemplates = {};

export function getTemplate(
  type: NotificationType,
  data: Record<string, any>
): { title: string; message: string } {
  switch (type) {
    case 'SERVICE_PURCHASED':
      return {
        title: 'Service purchased',
        message: `Your service purchase request has been received${data?.serviceName ? `: ${data.serviceName}` : ''}.`,
      };
    case 'SERVICE_COMPLETED':
      return {
        title: 'Service completed',
        message: `Your service has been completed${data?.serviceName ? `: ${data.serviceName}` : ''}.`,
      };
    case 'SERVICE_FAILED':
      return {
        title: 'Service failed',
        message: `Your service request failed${data?.reason ? `: ${data.reason}` : ''}.`,
      };
    case 'REFUND_PROCESSED':
      return {
        title: 'Refund processed',
        message: `A refund has been processed${data?.amount ? `: ৳${data.amount}` : ''}.`,
      };
    case 'BALANCE_ADD_REQUESTED':
      return {
        title: 'Balance add requested',
        message: `Your balance add request has been created${data?.amount ? `: ৳${data.amount}` : ''}.`,
      };
    case 'BALANCE_ADD_APPROVED':
      return {
        title: 'Balance add approved',
        message: `Your balance add request was approved${data?.amount ? `: ৳${data.amount}` : ''}.`,
      };
    case 'BALANCE_ADD_REJECTED':
      return {
        title: 'Balance add rejected',
        message: `Your balance add request was rejected${data?.reason ? `: ${data.reason}` : ''}.`,
      };
    default:
      return {
        title: 'Notification',
        message: 'You have a new notification.',
      };
  }
}
