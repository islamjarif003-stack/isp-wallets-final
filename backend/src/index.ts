process.env.LOG_LEVEL = 'debug'; // Temporary for debugging
import { env } from './config/env';
import { app } from './app';
import { connectDatabases, disconnectDatabases } from './config/database';
import { redisConnection } from './config/redis';
import { getLogger } from './utils/logger';
import { Queue, QueueEvents } from 'bullmq';
import { ISP_RENEWAL_QUEUE_NAME, ispRenewalQueue } from './queues/ispRenewal.queue';
import { getServiceDb, getAccountWalletDb } from './config/database';
import { ServiceService } from './modules/services/service.service';
import { WalletService } from './modules/wallet/wallet.service';
import { NotificationService } from './modules/notification/notification.service';
import { ExecutionStatus } from '@prisma/service-client';
import { notifyServiceCompleted } from './modules/notification/notification.queue';

async function bootstrap(): Promise<void> {
  process.env.LOG_LEVEL = 'debug'; // Temporary for debugging
  const logger = getLogger();
  try {
    await connectDatabases();
    logger.info('All databases connected');

    const serviceDb = getServiceDb();
    const accountWalletDb = getAccountWalletDb();
    const walletService = new WalletService();
    const notificationService = new NotificationService();
    const serviceService = new ServiceService();

    if (env.REDIS_ENABLED) {
      logger.info('Redis initialized');
    } else {
      logger.warn('Redis disabled');
    }

    const ispRenewalQueueEvents = new QueueEvents(ISP_RENEWAL_QUEUE_NAME, { connection: redisConnection });
    logger.info(`BullMQ QueueEvents for ${ISP_RENEWAL_QUEUE_NAME} initialized`);

    ispRenewalQueueEvents.on('completed', async ({ jobId, returnvalue }) => {
      logger.info(`ISP Renewal Job ${jobId} completed`, { returnvalue });
      const job = await ispRenewalQueue.getJob(jobId);
      if (!job) {
        logger.error(`Could not find job with id ${jobId}`);
        return;
      }

      const { executionLogId, userId, packageId, amount } = job.data as any;
      const { subscriptionId, subscriberName, address, area } = returnvalue as any;

      try {
        const newHomeService = await serviceDb.homeService.create({
          data: {
            userId,
            packageId,
            connectionId: subscriptionId,
            subscriberName,
            address,
            area,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });

        await serviceDb.serviceExecutionLog.update({
          where: { id: executionLogId },
          data: {
            status: ExecutionStatus.COMPLETED,
            completedAt: new Date(),
            responsePayload: returnvalue as any,
            serviceRecordId: newHomeService.id,
          },
        });

        notifyServiceCompleted(userId, 'Home Internet');
      } catch (error) {
        logger.error(`Error handling completed ISP Renewal Job ${jobId}`, { error });
      }
    });

    ispRenewalQueueEvents.on('failed', async ({ jobId, failedReason }) => {
      logger.error(`[FAILED_HANDLER] Job ${jobId} failed: ${failedReason}. Entering handler.`);
      const job = await ispRenewalQueue.getJob(jobId);
      if (!job) {
        logger.error(`[FAILED_HANDLER] Could not find job with id ${jobId}. Exiting handler.`);
        return;
      }
      logger.debug(`[FAILED_HANDLER] Fetched job object for job ${jobId}.`);

      const { executionLogId } = job.data as any;

      try {
        logger.debug(`[FAILED_HANDLER] Updating execution log ${executionLogId} to FAILED.`);
        await serviceDb.serviceExecutionLog.update({
          where: { id: executionLogId },
          data: {
            status: ExecutionStatus.FAILED,
            responsePayload: { failedReason } as any,
            errorMessage: failedReason,
          },
        });
        logger.debug(`[FAILED_HANDLER] Updated execution log ${executionLogId}.`);

        logger.debug(`[FAILED_HANDLER] Fetching full execution log ${executionLogId}.`);
        const executionLog = await serviceDb.serviceExecutionLog.findUnique({ where: { id: executionLogId } });
        logger.debug(`[FAILED_HANDLER] Fetched full execution log.`);

        if (executionLog) {
          logger.debug(`[FAILED_HANDLER] Execution log found. Fetching package name.`);
          const packageName = executionLog.packageId
            ? (await serviceDb.servicePackage.findUnique({ where: { id: executionLog.packageId } }))?.name || 'Unknown Service'
            : 'Unknown Service';
          logger.debug(`[FAILED_HANDLER] Package name: ${packageName}. Calling handleExecutionFailure.`);

          await serviceService.handleExecutionFailure(
            executionLog.id,
            executionLog.walletTransactionId || '',
            executionLog.userId,
            packageName,
            new Error(failedReason)
          );
          logger.debug(`[FAILED_HANDLER] handleExecutionFailure completed for job ${jobId}.`);
        } else {
          logger.error(`[FAILED_HANDLER] Could not find execution log ${executionLogId} after update.`);
        }
      } catch (error) {
        logger.error(`[FAILED_HANDLER] Error handling failed ISP Renewal Job ${jobId}`, { error });
      }
      logger.info(`[FAILED_HANDLER] Finished processing failed job ${jobId}.`);
    });

    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Server started on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        apiVersion: env.API_VERSION,
      });
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabases();
        await redisConnection.quit();
        logger.info('All connections closed. Exiting.');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection', { reason });
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

bootstrap();
