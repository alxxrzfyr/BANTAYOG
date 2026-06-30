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

# -----------------------------------------------------------------------
# D1 — has_role() resolves via table-membership even with empty JWT claim,
# AND must NOT privilege-escalate a non-admin JWT into an admin query.
#
# Cloud probe uses an INSERT in a single transaction, then SET LOCAL for
# both role and jwt.claims. The probe must NOT persist seed rows.
#
# Requires the auth schema to exist on cloud (Supabase default). The
# auth_user_id/seed merchant fixture UUIDs are reproduced from local red-loop.sh
# to make replication obvious. Auth sign-up does NOT happen on cloud; we
# INSERT directly into auth.users (only the connection's user — service_role
# or a transaction privileged enough — has BypassRLS, and we'll run as the
# project's `postgres` role which has full supeuser on the cloud DB).
# -----------------------------------------------------------------------
echo "[D1-RLS] has_role('merchant') and has_role('admin') for merchant JWT…"

d1_out=$(
  psql_cloud <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;

-- Seed auth.users row (idempotent — ON CONFLICT). The fixed UUID aaaaaaaa-
-- is the same smoke fixture from the local red-loop.sh.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'cloud-seed-merchant@test.local',
          '{}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

-- Seed public.merchants row pointing at that auth.users id.
INSERT INTO public.merchants (id, auth_user_id, store_name, owner_name,
                              mobile_number_e164, wallet_address, status)
  VALUES ('c1111111-1111-1111-1111-111111111111',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'Cloud Seed Sari-sari', 'Cloud Seed Owner',
          '+639170000001',
          '0x0000000000000000000000000000000000000001', 'APPROVED')
  ON CONFLICT (id) DO NOTHING;

SET LOCAL "request.jwt.claims" TO
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{}}';
SELECT public.has_role('merchant') AS ok_merchant,
       public.has_role('admin')    AS ok_admin;
ROLLBACK;
SQL
) 2>&1

if echo "$d1_out" | grep -qE '^[[:space:]]+t[[:space:]]+\|[[:space:]]+f[[:space:]]'; then
  echo "[D1] PASS — table-membership fallback works; merchant JWT does NOT escalate to admin"
else
  echo "[D1] FAIL — either table fallback returned false OR merchant JWT escalated to admin"
  failures=$((failures + 1))
fi

echo
echo "[summary] failures=$failures"
exit $failures
