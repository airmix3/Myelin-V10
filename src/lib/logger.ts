import pino from 'pino';

// Plain JSON logging — pino-pretty's worker thread breaks under Next.js dev HMR
// (thread-stream loses module resolution after .next cache rebuilds).
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
