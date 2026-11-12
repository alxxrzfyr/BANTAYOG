// BE1 owns this file. Requirements: funded grant contract and RPC trust boundary.
import { describe, expect, it, vi } from 'vitest'
import { FundRepository } from './fund.repository.js'

function repository(data: unknown, error: unknown = null) {
  const db = { rpc: vi.fn().mockResolvedValue({ data, error }) }
  return { db, fund: new FundRepository(db as never) }
}

describe('FundRepository grant RPC boundary', () => {
  it.each([
    { outcome: 'acquired' }, { outcome: 'busy' }, { outcome: 'issued' },
    { outcome: 'insufficient', availablePhp: '0.00' },
    { outcome: 'insufficient', availablePhp: '4999.99' },
  ])('returns only parsed reservation data: %j', async result => {
    const { db, fund } = repository(result)
    expect(await fund.reserveGrant('child', 'attempt', '5000.00')).toEqual(result)
    expect(db.rpc.mock.calls).toEqual([['reserve_grant_funding', {
      p_beneficiary_id: 'child', p_attempt_id: 'attempt', p_amount_php: '5000.00',
    }]])
  })
  it.each([
    null, undefined, true, 'acquired', [], {}, { outcome: 'unknown' },
    { outcome: 'acquired', availablePhp: '0.00' }, { outcome: 'busy', retry: true },
    { outcome: 'issued', availablePhp: null }, { outcome: 'insufficient' },
    ...[null, 5000, '', '-1.00', '01.00', '1', '1.000', '1e3', 'NaN', ' 1.00', '1.00\n']
      .map(availablePhp => ({ outcome: 'insufficient', availablePhp })),
  ].map(data => ({ data })))('rejects malformed reservation proof: $data', async ({ data }) => {
    await expect(repository(data).fund.reserveGrant('child', 'attempt', '5000.00'))
      .rejects.toThrow('Invalid grant reservation response.')
  })
  it('propagates database errors without treating a returned acquisition as permission', async () => {
    const error = { code: 'XX000', message: 'Database failure.' }
    await expect(repository({ outcome: 'acquired' }, error).fund.reserveGrant('child', 'attempt', '5000.00'))
      .rejects.toEqual(error)
  })
  it.each([true, false])('returns a strict boolean finalization result: %s', async result => {
    const { db, fund } = repository(result)
    expect(await fund.markGrantIssued('child', 'attempt')).toBe(result)
    expect(db.rpc.mock.calls).toEqual([['mark_grant_funded', { p_beneficiary_id: 'child', p_attempt_id: 'attempt' }]])
  })
  it.each([null, undefined, 0, 1, '', 'true', 'false', {}, [], { result: true }].map(data => ({ data })))('rejects malformed finalization proof: $data', async ({ data }) => {
    await expect(repository(data).fund.markGrantIssued('child', 'attempt')).rejects.toThrow('Invalid grant finalization response.')
  })
  it('propagates finalization database errors before reading data', async () => {
    const error = { code: 'XX000', message: 'Database failure.' }
    await expect(repository(true, error).fund.markGrantIssued('child', 'attempt')).rejects.toEqual(error)
  })
})
