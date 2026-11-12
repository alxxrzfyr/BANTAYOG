# Local sandbox setup

The PayPal build has not been deployed to the existing public application. Use this source
checkout and your own sandbox keys. [verification.md](verification.md) records the tests that ran.

1. Install Node 20 or later and pnpm 9.15.0. Run `pnpm install --frozen-lockfile`.
2. Copy the three environment examples listed in the root README. Set the Supabase URL and keys
   on the server, and the public Supabase values on the web app. Set a private `QR_TOKEN_SECRET`
   and `CUSTODIAL_KEY_ENCRYPTION_KEY`; never use the example text as a key.
3. Set the PayPal sandbox and Gemini values in [the server guide](../../apps/server/README.md).
   Use `CORS_ORIGIN=http://localhost:3000,https://localhost` for local checkout. Set
   `RECONCILE_INTERVAL_MS=0` until the Stellar testnet keys are configured.
4. Prepare the database as described below. Create test users in your own project with
   `supabase/setup-test-users.js`. That script uses test passwords. Create the merchant profile
   through the existing admin registration flow before signing in as that merchant.
5. Run `pnpm dev`. Open `/fund` for a guest contribution, `/admin/fund` for the admin ledger,
   `/dashboard/settlements` for merchant claims and `/admin/settlements` for officer review.

The public contribution flow does not need Stellar keys. A new invoice needs a confirmed food
sale. Configure the existing Stellar testnet flow and complete a sale before an invoice test,
or use an existing confirmed synthetic sale in your own test project. Do not mark a real sale
confirmed by hand. Contributions do not issue child credits or pay invoices from a pooled fund.

## New database

Use a new Supabase project whose `public` schema has no application tables or views. Generate
the SQL file from the repository root:

```sh
node scripts/create-fresh-supabase-sql.mjs fresh-bantayog.sql
```

Review the file, then run the full file once in that new project's SQL editor. It uses one
transaction and refuses a nonempty `public` schema. It skips historical migration `00006`,
which repeats the embedding column from `00005`, and enables the UUID extension required by
`00010`. It keeps all applied migration source files unchanged. The generator refuses to
overwrite an existing output file.

After success, run `supabase/seed.sql` once for the product catalog. The generated SQL does not
write Supabase CLI migration history. Continue with reviewed unapplied SQL files; do not run
`supabase db push` against this installation without first reconciling its CLI migration history.

The database tests run the generated SQL and catalog seed in local PostgreSQL WASM. They check
table creation, payment functions, RLS flags, denied public reads, repeat-install refusal and
full rollback after a late error. They use minimal Auth and Storage schemas. This is not a test
of a new hosted Supabase project's Auth or Storage services.

## Existing database

Read [SCHEMA.md](../context/SCHEMA.md). Do not run the fresh-install file on an existing project.
Apply only the reviewed, unapplied migrations with owner approval. The PayPal additions are
`00018_paypal_settlement.sql` and `00019_paypal_fund.sql`. Never replay historical migration
`00011`: it contains a data reset from the earlier testnet cutover.

## Production build

Run `pnpm build`, then `pnpm --filter @bantayog/web start` with the API running separately.
Set `CORS_ORIGIN` to the HTTPS web origin when hosting. Configure the existing Upstash rate
limiter for public checkout. Serwist creates `apps/web/public/sw.js` during the build; that
generated file is local output and is not part of the source commit.
