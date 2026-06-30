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

# -----------------------------------------------------------------------
# D2 — transactions.stablecoin_amount_wei must accept the full uint256 range.
# -----------------------------------------------------------------------
echo "[D2-WEI] transactions.stablecoin_amount_wei NUMERIC upper bound…"

d2_out=$(
  psql_cloud <<'SQL'
BEGIN;
-- Seed beneficiary + transaction merchant fixtures (idempotent).
INSERT INTO public.beneficiaries (id, guardian_name, guardian_mobile_hash, child_name,
                                  child_age_months, monthly_income_php, gps_lat, gps_lng,
                                  card_serial)
  VALUES ('e3333333-3333-3333-3333-333333333333',
          'g', '$argon2id$demo', 'c', 12, 1000, 7.0, 125.0,
          'CLD-NPY-0001-AABB')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.merchants (id, auth_user_id, store_name, owner_name,
                              mobile_number_e164, wallet_address, status)
  VALUES ('f4444444-4444-4444-4444-444444444444',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'Cloud Tx Test Sari-sari', 'Cloud Tx Owner',
          '+639170000002',
          '0x0000000000000000000000000000000000000002', 'APPROVED')
  ON CONFLICT (id) DO NOTHING;

-- Attempt the insert with full uint256-max wei; rollback regardless.
INSERT INTO public.transactions
  (beneficiary_id, merchant_id, item_list_jsonb, total_credit_deducted,
   stablecoin_amount_wei, idempotency_key, status)
  VALUES
  ('e3333333-3333-3333-3333-333333333333',
   'f4444444-4444-4444-4444-444444444444',
   '[{"category":"EGGS","labelLocal":"Itlog","quantity":1,"subTotalCredits":1.00}]'::jsonb,
   1.00,
   115792089237316195423570985008687907853269984665640564039457584007913129639935::numeric,
   gen_random_uuid(),
   'PENDING_CHAIN');
ROLLBACK;
SQL
) 2>&1

# Postgres overflow errors match these substrings across versions 13–16.
if echo "$d2_out" | grep -qE 'value overflows|too large|out of range|numeric field overflow'; then
  echo "[D2] FAIL — uint256 wei does not fit in stablecoin_amount_wei (the bug)"
  failures=$((failures + 1))
else
  echo "[D2] PASS — uint256 wei fits in stablecoin_amount_wei"
fi

echo
echo "[summary] failures=$failures"
exit $failures
