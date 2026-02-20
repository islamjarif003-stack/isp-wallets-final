import { getLogger } from '../../../utils/logger';
import { AppError } from '../../../utils/errors';
import { ispRenewalQueue } from '../../../queues/ispRenewal.queue';
import * as database from '@config/database';
import { env } from '../../../config/env';
import { IServiceExecution } from '../service.types';
import { ExecutionStatus, ServiceType } from '@prisma/service-client';

const logger = getLogger();

export interface HomeInternetActivationInput {
  connectionId: string;
  packageName: string;
  subscriberName: string;
  amount: number;
  bandwidth?: string;
  validity?: string;
  execution: IServiceExecution;
}

export interface HomeInternetActivationResult {
  success: boolean;
  message: string;
  log: any;
  activatedAt?: Date;
  expiresAt?: Date;
}

export async function executeHomeInternetActivation(
  input: HomeInternetActivationInput
): Promise<HomeInternetActivationResult> {
  logger.info('Queueing home internet renewal job', {
    connectionId: input.connectionId,
    packageName: input.packageName,
  });

  // 1. Add job to the queue using the existing execution log
  await ispRenewalQueue.add(
    `renewal-${input.connectionId}-${input.execution.id}`,
    {
      executionLogId: input.execution.id,
      clientId: input.connectionId,
      amount: input.amount,
      packageName: input.packageName,
    }
  );

  await database.getServiceDb().serviceExecutionLog.update({
    where: { id: input.execution.id },
    data: {
      status: ExecutionStatus.QUEUED,
    },
  });

  logger.info(`Job ${input.execution.id} queued for connection ${input.connectionId}`);

  return {
    success: true,
    message: 'Your internet renewal request has been queued and will be processed shortly.',
    log: { ...input.execution, status: ExecutionStatus.QUEUED },
  };
}
