// BE1 owns this file. Requirements: funded grant contract. Local PostgreSQL only.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const child = '00000000-0000-4000-8000-000000000001'
const otherChild = '00000000-0000-4000-8000-000000000002'
const attempt = '10000000-0000-4000-8000-000000000001'
const otherAttempt = '10000000-0000-4000-8000-000000000002'
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  // These existing columns are the external boundary. Fresh-install tests use the full schema.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.beneficiaries (id UUID PRIMARY KEY);
    CREATE TABLE public.allocations (beneficiary_id UUID UNIQUE REFERENCES public.beneficiaries(id),
      amount_phpc NUMERIC(12,2) NOT NULL CHECK (amount_phpc IN (5000, 3500)), onchain_tx_hash TEXT);
    CREATE TABLE public.transactions (total_amount NUMERIC(12,2), status TEXT);
    CREATE TABLE public.settlement_invoices (total_amount_php NUMERIC(12,2), status TEXT);
  `)
  for (const name of ['00019_paypal_fund.sql', '00020_fund_backed_grants.sql']) {
    await db.exec(readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
}, 30_000)
beforeEach(async () => {
  await db.exec('BEGIN')
  await db.query('INSERT INTO public.beneficiaries VALUES ($1), ($2)', [child, otherChild])
})
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db.close() })

async function reserve(beneficiaryId: string | null = child, attemptId: string | null = attempt, amountPhp: string | null = '5000.00') {
  const result = await db.query<{ result: unknown }>(
    'SELECT public.reserve_grant_funding($1::uuid, $2::uuid, $3::text) AS result',
    [beneficiaryId, attemptId, amountPhp])
  return result.rows[0].result
}

async function contribute(gross: string, fee: string, net: string) {
  await db.query(`INSERT INTO public.fund_topups
    (id, amount_php, status, paypal_order_id, paypal_capture_id, fee_php, net_amount_php, completed_at)
    VALUES (gen_random_uuid(), $1, 'COMPLETED', '5O190127TN364715T', '3C679366HH908993F', $2, $3, now())`,
  [gross, fee, net])
}

async function mark(beneficiaryId: string | null = child, attemptId: string | null = attempt) {
  const result = await db.query<{ result: boolean }>(
    'SELECT public.mark_grant_funded($1::uuid, $2::uuid) AS result', [beneficiaryId, attemptId])
  return result.rows[0].result
}

describe('funded grant SQL boundary', () => {
  it('rejects a grant when the fund is empty', async () => {
    expect(await reserve()).toEqual({ outcome: 'insufficient', availablePhp: '0.00' })
  })
  it('acquires exactly funded grants and holds the full amount for the first attempt', async () => {
    await contribute('5016.95', '16.95', '5000.00')
    expect(await reserve()).toEqual({ outcome: 'acquired' })
    expect((await db.query(`SELECT beneficiary_id, attempt_id, amount_php::text, status
      FROM public.fund_grant_reservations`)).rows).toEqual([
      { beneficiary_id: child, attempt_id: attempt, amount_php: '5000.00', status: 'RESERVED' },
    ])
    expect(await reserve(otherChild, otherAttempt, '3500.00')).toEqual({ outcome: 'insufficient', availablePhp: '0.00' })
  })
  it('keeps a reserved child busy for the same attempt and a different attempt', async () => {
    await contribute('10000.00', '0.00', '10000.00')
    expect(await reserve()).toEqual({ outcome: 'acquired' })
    expect(await reserve()).toEqual({ outcome: 'busy' })
    expect(await reserve(child, otherAttempt, '3500.00')).toEqual({ outcome: 'busy' })
    expect((await db.query('SELECT attempt_id, amount_php::text FROM public.fund_grant_reservations')).rows)
      .toEqual([{ attempt_id: attempt, amount_php: '5000.00' }])
  })
  it.each([null, 'legacy-chain-proof'])('blocks an existing allocation (%s) without debiting the new fund', async hash => {
    await contribute('5000.00', '0.00', '5000.00')
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, hash])
    expect(await reserve()).toEqual({ outcome: 'issued' })
    expect(await reserve(otherChild, otherAttempt)).toEqual({ outcome: 'acquired' })
    expect((await db.query('SELECT count(*)::int AS count FROM public.fund_grant_reservations')).rows)
      .toEqual([{ count: 1 }])
  })
  it('issues only with owned matching proof and keeps repeated finalization idempotent', async () => {
    await contribute('5000.00', '0.00', '5000.00')
    expect(await mark()).toBe(false)
    expect(await reserve()).toEqual({ outcome: 'acquired' })
    expect(await mark()).toBe(false)
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, 'chain-proof'])
    expect(await mark(child, otherAttempt)).toBe(false)
    expect(await mark(otherChild, attempt)).toBe(false)
    expect((await db.query('SELECT status FROM public.fund_grant_reservations')).rows).toEqual([{ status: 'RESERVED' }])
    expect(await mark()).toBe(true)
    expect(await mark()).toBe(true)
    expect(await mark(child, otherAttempt)).toBe(false)
    expect((await db.query('SELECT status FROM public.fund_grant_reservations')).rows).toEqual([{ status: 'ISSUED' }])
    expect(await reserve()).toEqual({ outcome: 'issued' })
    expect(await reserve(otherChild, otherAttempt, '3500.00')).toEqual({ outcome: 'insufficient', availablePhp: '0.00' })
  })
  it('preserves ledger columns and appends SQL-owned backed and available amounts', async () => {
    await contribute('11000.00', '1000.00', '10000.00')
    await db.query('INSERT INTO public.allocations VALUES ($1, 3500.00, $2)', [otherChild, 'legacy-proof'])
    await db.exec(`INSERT INTO public.transactions VALUES (125.50, 'CONFIRMED'), (20.00, 'RECONCILED'), (99.00, 'FAILED');
      INSERT INTO public.settlement_invoices VALUES (50.00, 'PAID'), (10.00, 'SENT');`)
    expect(await reserve()).toEqual({ outcome: 'acquired' })
    const ledger = await db.query('SELECT * FROM public.fund_ledger_summary')
    expect(ledger.fields.map(field => field.name)).toEqual([
      'gross_contributions_php', 'fees_php', 'net_contributions_php', 'grants_issued_php', 'grant_count',
      'confirmed_sales_php', 'paid_invoices_php', 'owed_php', 'backed_grants_php', 'available_to_grant_php',
    ])
    expect(ledger.rows).toEqual([{ gross_contributions_php: '11000.00', fees_php: '1000.00',
      net_contributions_php: '10000.00', grants_issued_php: '3500.00', grant_count: 1,
      confirmed_sales_php: '145.50', paid_invoices_php: '50.00', owed_php: '95.50',
      backed_grants_php: '5000.00', available_to_grant_php: '5000.00' }])
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, 'new-proof'])
    expect(await mark()).toBe(true)
    expect((await db.query('SELECT backed_grants_php, available_to_grant_php, grants_issued_php FROM public.fund_ledger_summary')).rows)
      .toEqual([{ backed_grants_php: '5000.00', available_to_grant_php: '5000.00', grants_issued_php: '8500.00' }])
  })
  it('does not fund grants from fees or uncompleted contributions', async () => {
    await contribute('5000.00', '0.01', '4999.99')
    await db.exec(`INSERT INTO public.fund_topups(id, amount_php) VALUES (gen_random_uuid(), 100000.00)`)
    expect(await reserve()).toEqual({ outcome: 'insufficient', availablePhp: '4999.99' })
    expect((await db.query('SELECT count(*)::int AS count FROM public.fund_grant_reservations')).rows).toEqual([{ count: 0 }])
  })
  it('funds both children when their exact total is available', async () => {
    await contribute('8500.00', '0.00', '8500.00')
    expect(await reserve()).toEqual({ outcome: 'acquired' })
    expect(await reserve(otherChild, otherAttempt, '3500.00')).toEqual({ outcome: 'acquired' })
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, 'chain-proof'])
    expect(await mark()).toBe(true)
    expect((await db.query('SELECT backed_grants_php, available_to_grant_php FROM public.fund_ledger_summary')).rows)
      .toEqual([{ backed_grants_php: '8500.00', available_to_grant_php: '0.00' }])
  })
  it.each([null, '', '5000', '3500', '05000.00', '5000.000', '5000.004', '5000.01', ' 5000.00', '5000.00 ', '5000.00\n', '5e3', 'NaN', '-3500.00', 'Infinity'])(
    'rejects malformed amount %s before conversion', async amount => {
      await expect(reserve(child, attempt, amount)).rejects.toMatchObject({ code: '22023' })
    })
  it.each([[null, attempt], [child, null]])('rejects null reservation IDs (%s, %s)', async (beneficiaryId, attemptId) => {
    await expect(reserve(beneficiaryId, attemptId)).rejects.toMatchObject({ code: '22023' })
  })
  it.each([[null, attempt], [child, null]])('does not finalize null IDs (%s, %s)', async (beneficiaryId, attemptId) => {
    expect(await mark(beneficiaryId, attemptId)).toBe(false)
  })
  it.each([null, '', '   ', '\t', '\n', ' \t\r\n '])('retains the reservation when the allocation hash is %s', async hash => {
    await contribute('5000.00', '0.00', '5000.00')
    await reserve()
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, hash])
    expect(await mark()).toBe(false)
    expect((await db.query('SELECT status FROM public.fund_grant_reservations')).rows).toEqual([{ status: 'RESERVED' }])
  })
  it('retains the reservation when the allocation amount differs', async () => {
    await contribute('5000.00', '0.00', '5000.00')
    await reserve()
    await db.query('INSERT INTO public.allocations VALUES ($1, 3500.00, $2)', [child, 'chain-proof'])
    expect(await mark()).toBe(false)
    expect((await db.query('SELECT status FROM public.fund_grant_reservations')).rows).toEqual([{ status: 'RESERVED' }])
  })
  it('rechecks proof even after a reservation was issued', async () => {
    await contribute('5000.00', '0.00', '5000.00')
    await reserve()
    await db.query('INSERT INTO public.allocations VALUES ($1, 5000.00, $2)', [child, 'chain-proof'])
    expect(await mark()).toBe(true)
    await db.query('UPDATE public.allocations SET onchain_tx_hash = null WHERE beneficiary_id = $1', [child])
    expect(await mark()).toBe(false)
  })
  it('does not reuse an attempt for another child', async () => {
    await contribute('10000.00', '0.00', '10000.00')
    await reserve()
    await expect(reserve(otherChild, attempt)).rejects.toMatchObject({ code: '23505' })
  })
  it('does not delete held funds when a child is deleted', async () => {
    await contribute('5000.00', '0.00', '5000.00')
    await reserve()
    await db.exec('SAVEPOINT deletion')
    await expect(db.query('DELETE FROM public.beneficiaries WHERE id = $1', [child])).rejects.toMatchObject({ code: '23001' })
    await db.exec('ROLLBACK TO SAVEPOINT deletion')
    expect((await db.query('SELECT status FROM public.fund_grant_reservations')).rows).toEqual([{ status: 'RESERVED' }])
  })
  it('rejects a nonexistent child without a grant', async () => {
    await contribute('5000.00', '0.00', '5000.00')
    await expect(reserve('00000000-0000-4000-8000-000000000099')).rejects.toMatchObject({ code: '23503' })
  })
  it('blocks an issued reservation even when the allocation is absent', async () => {
    await db.query(`INSERT INTO public.fund_grant_reservations(beneficiary_id, attempt_id, amount_php, status)
      VALUES ($1, $2, 5000.00, 'ISSUED')`, [child, attempt])
    expect(await reserve()).toEqual({ outcome: 'issued' })
  })
  it.each(['repeatable read', 'serializable'])('rejects unsupported isolation %s', async isolation => {
    await db.exec('ROLLBACK')
    await db.exec(`BEGIN ISOLATION LEVEL ${isolation}`)
    await expect(reserve()).rejects.toMatchObject({ code: '25000' })
  })
  it.each(['repeatable read', 'serializable'])('does not finalize under isolation %s', async isolation => {
    await db.exec('ROLLBACK')
    await db.exec(`BEGIN ISOLATION LEVEL ${isolation}`)
    await expect(mark()).rejects.toMatchObject({ code: '25000' })
  })
  it('enforces service-only reads and function writes', async () => {
    const table = await db.query(`SELECT relrowsecurity,
      has_table_privilege('service_role', oid, 'SELECT') AS service_read,
      has_table_privilege('service_role', oid, 'INSERT,UPDATE,DELETE') AS service_write,
      has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
      has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_access
      FROM pg_class WHERE oid = 'public.fund_grant_reservations'::regclass`)
    expect(table.rows).toEqual([{ relrowsecurity: true, service_read: true,
      service_write: false, anon_access: false, authenticated_access: false }])
    for (const signature of ['public.reserve_grant_funding(uuid,uuid,text)', 'public.mark_grant_funded(uuid,uuid)']) {
      const functions = await db.query(`SELECT prosecdef, provolatile, proconfig,
        has_function_privilege('service_role', oid, 'EXECUTE') AS service_execute,
        has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute
        FROM pg_proc WHERE oid = $1::regprocedure`, [signature])
      expect(functions.rows).toEqual([{ prosecdef: true, provolatile: 'v', proconfig: ['search_path=public'],
        service_execute: true, anon_execute: false, authenticated_execute: false }])
    }
    await db.exec('SET LOCAL ROLE service_role')
    expect(await reserve()).toEqual({ outcome: 'insufficient', availablePhp: '0.00' })
    expect(await mark()).toBe(false)
  })
  it.each(['anon', 'authenticated'])('denies %s table reads', async role => {
    await db.exec(`SET LOCAL ROLE ${role}`)
    await expect(db.query('SELECT * FROM public.fund_grant_reservations')).rejects.toMatchObject({ code: '42501' })
  })
  it.each(['anon', 'authenticated'])('denies %s function calls', async role => {
    await db.exec(`SET LOCAL ROLE ${role}`)
    await expect(reserve()).rejects.toMatchObject({ code: '42501' })
  })
})
