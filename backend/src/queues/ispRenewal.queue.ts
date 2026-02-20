import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const ISP_RENEWAL_QUEUE_NAME = 'isp-renewal';

export const ispRenewalQueue = new Queue(ISP_RENEWAL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second delay, then increase exponentially
    },
  },
});
