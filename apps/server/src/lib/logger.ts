/**
 * Pino structured logger.
 *
 * BE1 owns this file. Structured logging with request_id correlation
 * is wired up in P5 (T-5.2). For P1, this provides a basic logger interface.
 */
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // pino-pretty transport is loaded lazily in dev if available.
  // Full structured logging with request_id is wired in P5 (T-5.2).
})

export type Logger = typeof logger
