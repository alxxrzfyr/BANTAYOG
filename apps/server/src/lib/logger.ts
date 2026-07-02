/**
 * Pino structured logger.
 *
 * BE1 owns this file. Structured logging with request_id correlation
 * is wired up in P5 (T-5.2). For P1, this provides a basic logger interface.
 */
import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'pin',
      'pin_hash',
      'pin_hash_argon2id',
      'password',
      'privateKey',
      'authorization',
      'token',
      '*.pin',
      '*.pin_hash',
      '*.pin_hash_argon2id',
      '*.password',
      '*.privateKey',
      '*.authorization',
      '*.token'
    ],
    censor: '[REDACTED]'
  },
  ...(isDev ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  } : {})
})

export type Logger = typeof logger

