type LogMeta = Record<string, unknown>;

function safeMeta(meta?: unknown): LogMeta | undefined {
  if (!meta) return undefined;
  if (typeof meta === 'object') return meta as LogMeta;
  return { meta };
}

export const logger = {
  info(message: string, meta?: unknown): void {
    const m = safeMeta(meta);
    if (m) {
      console.log(message, m);
      return;
    }
    console.log(message);
  },

  warn(message: string, meta?: unknown): void {
    const m = safeMeta(meta);
    if (m) {
      console.warn(message, m);
      return;
    }
    console.warn(message);
  },

  error(message: string, meta?: unknown): void {
    const m = safeMeta(meta);
    if (m) {
      console.error(message, m);
      return;
    }
    console.error(message);
  },

  debug(message: string, meta?: unknown): void {
    const m = safeMeta(meta);
    if (m) {
      console.debug(message, m);
      return;
    }
    console.debug(message);
  },
};
