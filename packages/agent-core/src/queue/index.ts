export * from './types';
export * from './in-process';

/**
 * Resolve queue backend.
 * Today: in-process only (works on Vercel).
 * Later: if REDIS_URL is set and a worker process is running, use BullMQ.
 */
export function createJobQueue() {
  // BullMQ requires a long-lived worker — not available on pure Vercel serverless.
  // Keep REDIS_URL for future dedicated worker / Railway / Fly.io deploy.
  return {
    mode: process.env.REDIS_URL ? ('redis-configured-but-in-process-fallback' as const) : ('in-process' as const),
    redisUrl: process.env.REDIS_URL || null,
  };
}
