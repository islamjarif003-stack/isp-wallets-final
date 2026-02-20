type LogMeta = Record<string, unknown>;

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

export const getLogger = () => {
  const currentLogLevel: LogLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';
  const currentLogLevelValue = LOG_LEVELS[currentLogLevel];

  console.log(`Logger initialized with LOG_LEVEL: ${currentLogLevel} (value: ${currentLogLevelValue})`);

  function safeMeta(meta?: unknown): LogMeta | undefined {
    if (!meta) return undefined;
    if (typeof meta === 'object') return meta as LogMeta;
    return { meta };
  }

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= currentLogLevelValue;
  };

  return {
    info(message: string, meta?: unknown): void {
      if (!shouldLog('info')) return;
      const m = safeMeta(meta);
      if (m) {
        console.log(message, m);
        return;
      }
      console.log(message);
    },

    warn(message: string, meta?: unknown): void {
      if (!shouldLog('warn')) return;
      const m = safeMeta(meta);
      if (m) {
        console.warn(message, m);
        return;
      }
      console.warn(message);
    },

    error(message: string, meta?: unknown): void {
      if (!shouldLog('error')) return;
      const m = safeMeta(meta);
      if (m) {
        console.error(message, m);
        return;
      }
      console.error(message);
    },

    debug(message: string, meta?: unknown): void {
      if (!shouldLog('debug')) return;
      const m = safeMeta(meta);
      if (m) {
        console.debug(message, m);
        return;
      }
      console.debug(message);
    },
  };
};
