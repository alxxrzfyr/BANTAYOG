// BE1 owns this file. Requirements: PayPal settlement contract, sections 4-6.
// This formats one amount. All settlement sums remain in SQL.
export function formatPhp(value: unknown): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value))
  if (!match) throw new Error('Invalid stored PHP amount')
  const fraction = match[2] ?? ''
  const cents = BigInt(match[1]) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2)) +
    (fraction.length > 2 && fraction[2] >= '5' ? 1n : 0n)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

// Compare full stored unit prices before rounding them for display.
export function isPriceAbove(price: string | number, reference: string | number): boolean {
  const [whole, fraction = ''] = String(price).split('.')
  const [refWhole, refFraction = ''] = String(reference).split('.')
  const scale = Math.max(fraction.length, refFraction.length)
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`) > BigInt(`${refWhole}${refFraction.padEnd(scale, '0')}`)
}
