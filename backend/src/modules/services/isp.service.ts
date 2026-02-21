import { getServiceDb, getAccountWalletDb } from '../../config/database';
import { ispRenewalQueue } from '../../queues/ispRenewal.queue';
import { AppError } from '../../utils/errors';

export class IspService {
  async getLogs(query: any) {
    const { page = 1, limit = 10, status, connectionId } = query;
    const parsedPage = parseInt(page as string, 10);
    const parsedLimit = parseInt(limit as string, 10);
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (connectionId) {
      where.requestPayload = {
        path: ['connectionId'],
        equals: connectionId,
      };
    }

    const serviceDb = getServiceDb();
    const accountWalletDb = getAccountWalletDb();

    const logs = await serviceDb.serviceExecutionLog.findMany({
      where,
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await serviceDb.serviceExecutionLog.count({ where });

    // Extract unique user IDs from the logs
    const userIds = [...new Set(logs.map(log => log.userId))];

    // Fetch user full names
    const users = await accountWalletDb.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    // Create a map for quick lookup of user names
    const userMap = new Map(users.map(user => [user.id, user.fullName]));

    // Attach user names to the logs
    const logsWithUserNames = logs.map(log => ({
      ...log,
      userName: userMap.get(log.userId) || 'N/A', // Default to 'N/A' if user not found
    }));

    return { logs: logsWithUserNames, total, page: parsedPage, limit: parsedLimit };
  }

  async retryJob(logId: string) {
    const log = await getServiceDb().serviceExecutionLog.findUnique({
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
    await getServiceDb().serviceExecutionLog.update({
      where: { id: logId },
      data: { status: 'QUEUED' },
    });

    return { success: true, message: 'Job has been re-queued successfully.' };
  }
}
