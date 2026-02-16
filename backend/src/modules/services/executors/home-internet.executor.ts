import { logger } from '../../../utils/logger';
import { AppError } from '../../../utils/errors';

export interface HomeInternetActivationInput {
  connectionId: string;
  packageName: string;
  subscriberName: string;
  bandwidth?: string;
  validity?: number;
}

export interface HomeInternetActivationResult {
  success: boolean;
  activationId?: string;
  activatedAt?: Date;
  expiresAt?: Date;
  message: string;
}

/**
 * Home Internet Executor
 * Handles activation of home internet packages.
 * In production, this would call ISP's API.
 * Includes timeout and retry logic.
 */
export async function executeHomeInternetActivation(
  input: HomeInternetActivationInput
): Promise<HomeInternetActivationResult> {
  logger.info('Executing home internet activation', {
    connectionId: input.connectionId,
    packageName: input.packageName,
  });

  throw new AppError('Home internet activation executor is not implemented', 501);
}
