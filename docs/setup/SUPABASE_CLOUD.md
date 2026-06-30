# Supabase Cloud Setup Runbook

This runbook takes the migration from a working tree to a verified green
state on a Supabase **cloud** project (`supabase.com`). It is the canonical
follow-on to `docs/superpowers/plans/2026-06-29-fix-supabase-00001-audit.md`.

## Prerequisites

- macOS / Linux with `bash 4+`, `psql`, and the `supabase` CLI (>= 1.190.0).
- A Supabase **free-tier** project. Provision one at https://supabase.com/dashboard
  (org -> "New Project"). Pick the region closest to your Vercel deployment.
  Save the **database password** somewhere secure (1Password or similar).
- `git` working tree clean.

## One-time setup

```bash
# 1. Authenticate the CLI against supabase.com.
supabase login
# -> opens your browser; click Approve. Token is written to ~/.supabase.

# 2. Inspect the project's ref. It is the slug that appears in
#    https://app.supabase.com/project/<project-ref>/settings/database
#    e.g. "abcdefghijkl" if your URL is
#    https://app.supabase.com/project/abcdefghijkl/...
export PROJECT_REF=abcdefghijkl

# 3. Construct the connection string. The password is what you set when
#    provisioning the project. NEVER echo it to your terminal history;
#    source it from an env file that is itself gitignored.
export DATABASE_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
```

## Apply + verify

```bash
# 4. Link the local repo to the cloud project. Writes project-ref to
#    .supabase/config.toml; does NOT push.
supabase link --project-ref "$PROJECT_REF"

# 5. Apply the migration. Supabase wraps each migration file in a
#    transaction — all-or-nothing.
supabase db push

# 6. Run the cloud verifier. exit=0 means setup verified.
bash docs/superpowers/scripts/cloud-loop.sh
echo "exit=$?"

# 7. Capture green output for the PR description.
bash docs/superpowers/scripts/cloud-loop.sh 2>&1 | tee docs/superpowers/scripts/CLOUD-green-baseline.txt
```

## Failure modes

| Symptom | Action |
|---|---|
| `supabase db push` errors with `permission denied for schema auth` | Re-run after `supabase link --project-ref "$PROJECT_REF"`; the link step grants write access to the linked project only. |
| `[D1] FAIL` | DO NOT rerun `db push`; inspect `has_role` in Studio Query History. The migration is fine; the verifier is exposing an upstream bug in the migration body. Fix the migration, then re-push. |
| `[D2] FAIL` (numerical overflow) | The `stablecoin_amount_wei` column is `NUMERIC(38,0)` — the patch did not land. Re-push after fixing the column type. |
| `[D3] FAIL` (duplicate accepted) | The `jws_compact` UNIQUE is missing. Re-push after fixing. |
| `[cloud-loop] FATAL: DATABASE_URL does not match…` | Wrong shape. Check `${SUPABASE_DB_PASSWORD}` / `${PROJECT_REF}` are set; URL-format must be exactly `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres`. |

## Secrets handling

- The DB password lives **only** in the shell environment, sourced from a
  gitignored file like `.env.supabase` in the project root.
- No commit may contain the project-ref or DB password.
- `~/.supabase/access-token` is the supabase CLI's own secret store.
  Treat it the same way as a git-credential file.
