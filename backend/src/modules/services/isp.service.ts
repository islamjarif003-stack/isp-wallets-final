import { serviceDb } from '../../config/database';
import { ispRenewalQueue } from '../../queues/ispRenewal.queue';
import { AppError } from '../../utils/errors';

export class IspService {
  async getLogs(query: any) {
    const { page = 1, limit = 10, status, connectionId } = query;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (connectionId) {
      where.requestPayload = {
        path: ['connectionId'],
        string_contains: connectionId,
      };
    }

    const logs = await serviceDb.serviceExecutionLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await serviceDb.serviceExecutionLog.count({ where });

    return { logs, total, page, limit };
  }

  async retryJob(logId: string) {
    const log = await serviceDb.serviceExecutionLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new AppError('Log not found', 404);
    }

    if (!log.requestPayload || typeof log.requestPayload !== 'object') {
      throw new AppError('Invalid request payload in log', 500);
    }

    const { connectionId, amount } = log.requestPayload as { connectionId: string; amount: number };

    // Re-queue the job
    await ispRenewalQueue.add(
      `retry-${connectionId}-${log.id}`,
      {
        executionLogId: log.id,
        clientId: connectionId,
        amount: amount,
      }
    );

    // Update the log status to QUEUED
    await serviceDb.serviceExecutionLog.update({
      where: { id: logId },
      data: { status: 'QUEUED' },
    });

    return { success: true, message: 'Job has been re-queued successfully.' };
  }
}
