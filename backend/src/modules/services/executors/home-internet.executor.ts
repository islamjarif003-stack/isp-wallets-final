import { logger } from '../../../utils/logger';
import { AppError } from '../../../utils/errors';
import { ispRenewalQueue } from '../../../queues/ispRenewal.queue';
import { serviceDb } from '../../../config/database';
import { IServiceExecution, ServiceExecutionLog } from '../service.types';

export interface HomeInternetActivationInput {
  connectionId: string;
  packageName: string;
  subscriberName: string;
  amount: number;
  execution: IServiceExecution;
}

export interface HomeInternetActivationResult {
  success: boolean;
  message: string;
  log: ServiceExecutionLog;
}

export async function executeHomeInternetActivation(
  input: HomeInternetActivationInput
): Promise<HomeInternetActivationResult> {
  logger.info('Queueing home internet renewal job', {
    connectionId: input.connectionId,
    packageName: input.packageName,
  });

  // 1. Create an execution log
  const log = await serviceDb.serviceExecutionLog.create({
    data: {
      serviceExecutionId: input.execution.id,
      status: 'QUEUED',
      requestPayload: input as any,
    },
  });

  // 2. Add job to the queue
  await ispRenewalQueue.add(
    `renewal-${input.connectionId}-${log.id}`,
    {
      executionLogId: log.id,
      clientId: input.connectionId,
      amount: input.amount,
      packageName: input.packageName,
    }
  );

  logger.info(`Job ${log.id} queued for connection ${input.connectionId}`);

  return {
    success: true,
    message: 'Your internet renewal request has been queued and will be processed shortly.',
    log: log as any,
  };
}
