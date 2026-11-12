// BE1 owns this file. Requirements: PayPal settlement contract, section 4.
import { describe, expect, it } from 'vitest'
import { loadPayPalConfig } from './config.js'
import { collectConfiguredSecrets } from '../redact.js'

const env = {
  PAYPAL_CLIENT_ID: 'test-client',
  PAYPAL_CLIENT_SECRET: 'test-secret',
  PAYPAL_PROGRAM_PAYER_EMAIL: 'payer@example.com',
}

describe('PayPal configuration', () => {
  it('loads sandbox defaults and collects the secret', () => {
    const result = loadPayPalConfig(env)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.apiBase).toBe('https://api-m.sandbox.paypal.com')
    expect(collectConfiguredSecrets(result.value)).toContain(env.PAYPAL_CLIENT_SECRET)
  })

  it.each([
    'https://api-m.paypal.com', 'https://evil.example',
    'https://api-m.sandbox.paypal.com.evil.example', 'http://api-m.sandbox.paypal.com',
    'https://user:pass@api-m.sandbox.paypal.com', 'https://api-m.sandbox.paypal.com:444',
    'https://api-m.sandbox.paypal.com/path', 'invalid', '',
  ])('rejects unsafe base %s', (base) => {
    expect(loadPayPalConfig({ ...env, PAYPAL_API_BASE: base }).isErr()).toBe(true)
  })

  it('reports every invalid variable without its value', () => {
    const result = loadPayPalConfig({ PAYPAL_PROGRAM_PAYER_EMAIL: 'private-invalid' })
    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error).toMatchObject({ details: { invalidVariables: [
      'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_PROGRAM_PAYER_EMAIL',
    ] } })
    expect(JSON.stringify(result.error)).not.toContain('private-invalid')
  })
})
