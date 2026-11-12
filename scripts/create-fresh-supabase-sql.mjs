// Build one transaction for a new Supabase database without changing migration history.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const destination = process.argv[2]
if (!destination || process.argv.length !== 3) {
  console.error('Usage: node scripts/create-fresh-supabase-sql.mjs <new-output-file>')
  process.exit(1)
}

const directory = new URL('../supabase/migrations/', import.meta.url)
const names = readdirSync(directory)
  .filter(name => /^\d{5}_.+\.sql$/.test(name))
  .sort()
  // 00005 already supplies the column and index. 00007 replaces the search function.
  .filter(name => name !== '00006_image_embeddings.sql')

try {
  const statements = names.map(name => {
    let sql = readFileSync(new URL(name, directory), 'utf8')
    if (name.startsWith('00018_') || name.startsWith('00019_')) {
      // Keep the full install atomic, including migrations that have their own transaction.
      if (!/^BEGIN;\r?$/m.test(sql) || !/^COMMIT;\s*$/m.test(sql)) {
        throw new Error(`Expected transaction wrapper in ${name}`)
      }
      sql = sql.replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\s*$/m, '')
    }
    return `-- Source: ${name}\n${sql}`
  })
  const sql = `-- Fresh Supabase database only. Never run this on an existing installation.
-- Migration 00006 is redundant and is excluded. Applied migration files stay unchanged.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  ) THEN
    RAISE EXCEPTION 'Fresh install requires an empty public schema. No changes were made.';
  END IF;
END $$;
SET LOCAL search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
${statements.join('\n\n')}
COMMIT;
`
  writeFileSync(destination, sql, { encoding: 'utf8', flag: 'wx' })
  console.log(`Wrote ${names.length} migrations to ${destination}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
