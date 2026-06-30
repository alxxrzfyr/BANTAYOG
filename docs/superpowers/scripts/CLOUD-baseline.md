# Cloud baseline — `bash docs/superpowers/scripts/cloud-loop.sh`

Frozen expected output of `cloud-loop.sh` after the fix-supabase-00001-audit
patches are applied to a Supabase cloud project (`supabase.com`).

> Run on your local machine. Required: a project-ref, a DB password, and the
> `supabase` CLI installed (>= 1.190.0).

```bash
export DATABASE_URL='postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres'

# Apply the patched migration to cloud.
supabase db push

# Run the cloud verifier.
bash docs/superpowers/scripts/cloud-loop.sh
echo "exit=$?"
```

## Expected green output (post all four fix-supabase-00001-audit fixes applied)

```
[D1-RLS] has_role('merchant') and has_role('admin') for merchant JWT…
[D1] PASS — table-membership fallback works; merchant JWT does NOT escalate to admin
[D2-WEI] transactions.stablecoin_amount_wei NUMERIC upper bound…
[D2] PASS — uint256 wei fits in stablecoin_amount_wei
[D3-JWS] qr_tokens.jws_compact UNIQUE…
[D3] PASS — UNIQUE constraint blocks duplicate jws_compact

[summary] failures=0
exit=0
```

If any probe FAILs, do not commit. The cloud DB state is preserved so the
failure can be inspected via Supabase Studio Query History.
