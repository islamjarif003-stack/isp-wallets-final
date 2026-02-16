import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redisConfig = {
  url: env.REDIS_URL,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
};

let redisClient: Redis | null = null;

function buildRedisUrl(): string {
  if (redisConfig.url) return redisConfig.url;
  const auth = redisConfig.password ? `:${encodeURIComponent(redisConfig.password)}@` : '';
  return `redis://${auth}${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;
}

export function getRedis(): Redis {
  if (redisClient) return redisClient;
  if (!env.REDIS_ENABLED) {
    throw new Error('Redis is disabled by configuration');
  }
  const url = buildRedisUrl();
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  redisClient.on('error', (error) => {
    logger.error('Redis error', { error: error instanceof Error ? error.message : error });
  });
  return redisClient;
}

export function isRedisAvailable(): boolean {
  if (!env.REDIS_ENABLED) return false;
  try {
    const client = getRedis();
    return client.status === 'ready';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
