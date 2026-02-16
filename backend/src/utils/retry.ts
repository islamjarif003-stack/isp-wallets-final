export const retry = {};

export type RetryBackoff = 'fixed' | 'exponential';

export type RetryOptions = {
  maxAttempts: number;
  delayMs: number;
  backoff?: RetryBackoff;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return fn();

  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const baseDelay = Math.max(0, options.delayMs);
  const backoff: RetryBackoff = options.backoff || 'fixed';
  const timeoutMs = options.timeoutMs;
  const onRetry = options.onRetry;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs ?? 0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      if (attempt >= maxAttempts) break;

      if (onRetry) {
        onRetry(attempt, error);
      }

      const delay =
        backoff === 'exponential' ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry failed');
}
