import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  AuthError,
  RateLimitError,
  OnchainError,
  PersistenceError,
  JwtError,
  PolicyError,
  errorToHttpStatus,
  errorToResponseBody,
  ok,
  err,
  type AppResult,
} from './errors.js'

describe('Error classes', () => {
  it('ValidationError has correct _tag', () => {
    const e = new ValidationError('Invalid input')
    expect(e._tag).toBe('validation')
    expect(e.message).toBe('Invalid input')
  })

  it('AuthError has correct _tag and code', () => {
    const e = new AuthError('Forbidden', 'forbidden')
    expect(e._tag).toBe('auth')
    expect(e.code).toBe('forbidden')
  })

  it('RateLimitError has correct _tag and retryAfter', () => {
    const e = new RateLimitError('Too many requests', 30)
    expect(e._tag).toBe('rateLimit')
    expect(e.retryAfterSeconds).toBe(30)
  })

  it('OnchainError has correct _tag and code', () => {
    const e = new OnchainError('Chain call failed', -32000, '0xabc')
    expect(e._tag).toBe('onchain')
    expect(e.code).toBe(-32000)
    expect(e.txHash).toBe('0xabc')
  })

  it('PersistenceError has correct _tag', () => {
    const e = new PersistenceError('DB error', 'transactions')
    expect(e._tag).toBe('persistence')
    expect(e.table).toBe('transactions')
  })

  it('JwtError has correct _tag and reason', () => {
    const e = new JwtError('Token expired', 'expired')
    expect(e._tag).toBe('jwt')
    expect(e.reason).toBe('expired')
  })

  it('PolicyError has correct _tag', () => {
    const e = new PolicyError('Non-allowlisted item', 'nutrition-policy')
    expect(e._tag).toBe('policy')
    expect(e.rule).toBe('nutrition-policy')
  })
})

describe('errorToHttpStatus', () => {
  it('maps validation → 400', () => {
    expect(errorToHttpStatus(new ValidationError('test'))).toBe(400)
  })

  it('maps auth forbidden → 403', () => {
    expect(errorToHttpStatus(new AuthError('test', 'forbidden'))).toBe(403)
  })

  it('maps auth expired → 401', () => {
    expect(errorToHttpStatus(new AuthError('test', 'expired'))).toBe(401)
  })

  it('maps rateLimit → 429', () => {
    expect(errorToHttpStatus(new RateLimitError('test'))).toBe(429)
  })

  it('maps onchain → 502', () => {
    expect(errorToHttpStatus(new OnchainError('test', 1))).toBe(502)
  })

  it('maps persistence → 500', () => {
    expect(errorToHttpStatus(new PersistenceError('test'))).toBe(500)
  })

  it('maps jwt → 401', () => {
    expect(errorToHttpStatus(new JwtError('test'))).toBe(401)
  })

  it('maps policy → 422', () => {
    expect(errorToHttpStatus(new PolicyError('test'))).toBe(422)
  })
})

describe('errorToResponseBody', () => {
  it('includes error tag and message', () => {
    const body = errorToResponseBody(new ValidationError('bad input'))
    expect(body.error).toBe('validation')
    expect(body.message).toBe('bad input')
  })

  it('includes details for ValidationError when present', () => {
    const body = errorToResponseBody(new ValidationError('bad input', { field: 'email' }))
    expect(body.details).toEqual({ field: 'email' })
  })

  it('does not include details when absent', () => {
    const body = errorToResponseBody(new AuthError('forbidden'))
    expect(body.details).toBeUndefined()
  })
})

describe('neverthrow helpers', () => {
  it('ok() creates a success Result', () => {
    const r: AppResult<string> = ok('success')
    expect(r.isOk()).toBe(true)
    expect(r.isErr()).toBe(false)
  })

  it('err() creates an error Result', () => {
    const r: AppResult<string> = err(new ValidationError('fail'))
    expect(r.isOk()).toBe(false)
    expect(r.isErr()).toBe(true)
  })
})
