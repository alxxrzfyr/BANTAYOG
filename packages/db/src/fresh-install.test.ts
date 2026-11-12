// BE1 owns this file. Fresh-install regression checks use local PostgreSQL only.
import { afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'bantayog-fresh-test-'))
const destination = join(scratch, 'fresh.sql')
const script = join(root, 'scripts/create-fresh-supabase-sql.mjs')
execFileSync(process.execPath, [script, destination])
const sql = readFileSync(destination, 'utf8')

// Supabase owns these schemas in a hosted project. No Auth or Storage service runs here.
const prelude = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_app_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT null::uuid';
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text);
`

async function database() {
  const db = new PGlite({ extensions: { vector, pg_trgm, uuid_ossp } })
  await db.exec(prelude)
  return db
}

async function expectFailure(db: PGlite, query: string, code: string) {
  await expect(db.exec(query)).rejects.toMatchObject({ code })
  await db.exec('ROLLBACK')
}

afterAll(() => {
  expect(dirname(resolve(scratch))).toBe(resolve(tmpdir()))
  rmSync(scratch, { recursive: true })
})

describe('fresh Supabase install', () => {
  it('requires an output file and never overwrites an existing file', () => {
    expect(spawnSync(process.execPath, [script]).status).toBe(1)
    expect(spawnSync(process.execPath, [script, destination]).status).toBe(1)
    expect(readFileSync(destination, 'utf8')).toBe(sql)
  })

  it('reproduces the duplicate-column error in the original migration order', async () => {
    const db = await database()
    try {
      const directory = join(root, 'supabase/migrations')
      const names = readdirSync(directory).filter(name => /^0000[1-6]_/.test(name)).sort()
      for (const name of names.slice(0, -1)) await db.exec(readFileSync(join(directory, name), 'utf8'))
      await expectFailure(db, readFileSync(join(directory, names.at(-1)!), 'utf8'), '42701')
    } finally {
      await db.close()
    }
  }, 30_000)

  it('installs the schema and seed, then refuses a second install without data loss', async () => {
    const db = await database()
    try {
      await db.exec(sql)
      const tables = ['beneficiaries', 'merchants', 'transactions', 'products', 'qr_passes',
        'beneficiary_wallets', 'merchant_wallets', 'outbox', 'allocations', 'market_prices',
        'product_variants', 'settlement_invoices', 'settlement_invoice_lines', 'fund_topups', 'fund_grant_reservations']
      for (const table of tables) {
        const result = await db.query('SELECT to_regclass($1) IS NOT NULL AS present', ['public.' + table])
        expect(result.rows[0]).toEqual({ present: true })
      }
      for (const table of ['settlement_invoices', 'settlement_invoice_lines', 'fund_topups', 'fund_grant_reservations']) {
        const result = await db.query(`SELECT relrowsecurity,
          has_table_privilege('anon', oid, 'SELECT') AS anon_read,
          has_table_privilege('authenticated', oid, 'SELECT') AS authenticated_read
          FROM pg_class WHERE oid = to_regclass($1)`, ['public.' + table])
        expect(result.rows[0]).toEqual({ relrowsecurity: true, anon_read: false, authenticated_read: false })
      }
      const functions = await db.query(`SELECT proname FROM pg_proc
        JOIN pg_namespace n ON n.oid = pronamespace WHERE n.nspname = 'public'
        AND proname IN ('create_settlement_proposal', 'approve_settlement', 'cancel_settlement',
          'create_fund_topup', 'record_fund_capture', 'reserve_grant_funding', 'mark_grant_funded')`)
      expect(functions.rows).toHaveLength(7)
      await db.exec(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'))
      const before = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM public.products')
      expect(before.rows[0].count).toBeGreaterThan(0)
      await expectFailure(db, sql, 'P0001')
      expect((await db.query('SELECT count(*)::int AS count FROM public.products')).rows).toEqual(before.rows)
    } finally {
      await db.close()
    }
  }, 30_000)

  it('rolls back the full install if a late migration fails', async () => {
    const db = await database()
    try {
      const broken = sql.replace(/COMMIT;\s*$/, 'SELECT missing_install_probe();\nCOMMIT;\n')
      await expectFailure(db, broken, '42883')
      const result = await db.query(`SELECT count(*)::int AS count FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')`)
      expect(result.rows[0]).toEqual({ count: 0 })
    } finally {
      await db.close()
    }
  }, 30_000)
})
