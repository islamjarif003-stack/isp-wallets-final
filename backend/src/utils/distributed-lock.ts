import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { generateIdempotencyKey } from './idempotency';
import { AppError } from './errors';

export const distributedLock = {};

type LockOptions = {
  ttlMs?: number;
  retryDelayMs?: number;
  retryCount?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  if (!env.REDIS_ENABLED) {
    return fn();
  }

  const ttlMs = options.ttlMs ?? env.LOCK_TTL_MS;
  const retryDelayMs = options.retryDelayMs ?? env.LOCK_RETRY_DELAY_MS;
  const retryCount = options.retryCount ?? env.LOCK_RETRY_COUNT;

  const redis = redisConnection;
  const lockKey = `lock:${key}`;
  const token = generateIdempotencyKey();

  for (let i = 0; i <= retryCount; i++) {
    const ok = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (ok === 'OK') break;
    if (i === retryCount) {
      throw new AppError('Concurrent operation in progress', 409);
    }
    await sleep(retryDelayMs);
  }

  try {
    return await fn();
  } finally {
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    try {
      await redis.eval(script, 1, lockKey, token);
    } catch {
      await redis.del(lockKey);
    }
  }
}
