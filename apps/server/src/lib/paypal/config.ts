// BE1 owns this file. Requirements: PayPal settlement contract, section 4.
import { z } from 'zod'
import { type AppResult, ValidationError, ok, err } from '../errors.js'

export interface PayPalConfig {
  clientId: string
  clientSecret: string
  payerEmail: string
  apiBase: string
}

export function loadPayPalConfig(env: Partial<Record<string, string | undefined>>): AppResult<PayPalConfig> {
  const invalidVariables: string[] = []
  const clientId = env.PAYPAL_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim() ?? ''
  const payerEmail = env.PAYPAL_PROGRAM_PAYER_EMAIL?.trim() ?? ''
  const apiBase = env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com'
  if (!clientId) invalidVariables.push('PAYPAL_CLIENT_ID')
  if (!clientSecret) invalidVariables.push('PAYPAL_CLIENT_SECRET')
  if (!z.string().email().safeParse(payerEmail).success) invalidVariables.push('PAYPAL_PROGRAM_PAYER_EMAIL')
  try {
    const url = new URL(apiBase)
    if (url.origin !== 'https://api-m.sandbox.paypal.com' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) invalidVariables.push('PAYPAL_API_BASE')
  } catch {
    invalidVariables.push('PAYPAL_API_BASE')
  }
  if (invalidVariables.length) return err(new ValidationError('Invalid PayPal configuration', { invalidVariables }))
  return ok({ clientId, clientSecret, payerEmail, apiBase: 'https://api-m.sandbox.paypal.com' })
}
