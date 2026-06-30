#!/usr/bin/env bash
# cloud-loop.sh — red-capable verifier for Supabase cloud DB.
# Companion to docs/superpowers/plans/2026-06-29-supabase-cloud-setup.md
# Exit code = number of failing probes (0 = all green).
set -euo pipefail

# -----------------------------------------------------------------------
# Preflight: DATABASE_URL must be a Supabase cloud Postgres URL.
# -----------------------------------------------------------------------
: "${DATABASE_URL:?[cloud-loop] DATABASE_URL is required. Set it to the connection string: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres}"

if ! [[ "$DATABASE_URL" =~ ^postgresql://[^:]+:[^@]+@db\.[a-z0-9-]+\.supabase\.co:5432/[^?]+$ ]]; then
  echo "[cloud-loop] FATAL: DATABASE_URL does not match the Supabase cloud shape." >&2
  echo "[cloud-loop]   expected: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" >&2
  echo "[cloud-loop]   got:      $DATABASE_URL" >&2
  exit 64
fi

PG_CONN_ARGS=(-v ON_ERROR_STOP=1)

# Common psql invocation prefix; callers append `<<SQL ... SQL`.
psql_cloud() {
  psql "$DATABASE_URL" "${PG_CONN_ARGS[@]}" -X --quiet "$@"
}

failures=0

# Probes attached by Tasks 2-4.
# D1: has_role hybrid + privilege-escalation regression probe (Task 2).
# D2: stablecoin_amount_wei NUMERIC(78,0) probe (Task 3).
# D3: qr_tokens.jws_compact UNIQUE probe (Task 4).

echo "[bootstrap] cloud-loop.sh loaded (no probes attached)"
exit $failures
