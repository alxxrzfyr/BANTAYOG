# BANTAYOG Web — Auth & Admin Flow Fix Spec

## Problem Statement

Upon running `pnpm dev` in `apps/web` and navigating to `localhost:3000`, the user encounters errors on both the **login page** and **admin pages after login**, making it impossible to use any features of the application.

The user's primary login page is the **root `/login`** route (`apps/web/app/(auth)/login/page.tsx`), which uses Supabase `signInWithPassword`. The error displayed is **"Invalid email or password. Please try again."** — meaning the Supabase auth call reaches the server but credentials don't match any existing user.

---

## Root Cause Analysis

After a thorough codebase analysis, **six distinct issues** have been identified that collectively prevent the app from working:

### Issue 1: No Test Users in Supabase (Primary Login Failure)

**File:** `supabase/seed.sql` (lines 1–7)
**File:** `apps/web/app/(auth)/login/page.tsx` (line 55)

The `seed.sql` only seeds the `products` catalog table. The comment in the file explicitly states:

> TEST USERS: Create via Supabase Dashboard > Authentication > Users
> Admin: admin@bantayog.test / TestPassword123!
> Merchant: merchant@bantayog.test / TestPassword123!
> Set raw_app_meta_data to {"role": "admin"} or {"role": "merchant"}

**The user has not created these test users.** The `signInWithPassword` call at line 55 of the login page fails because no matching user exists in the Supabase `auth.users` table.

### Issue 2: Migration May Not Be Run (Tables Missing)

**File:** `supabase/migrations/00001_init_core_tables.sql`

The migration creates 5 core tables (`beneficiaries`, `merchants`, `transactions`, `products`, `qr_passes`) plus RLS policies, a `has_role()` helper function, and 2 storage buckets. The user confirmed they are "not sure" if the migration has been run. Without these tables, even after login succeeds, **all admin page data fetches will fail**.

### Issue 3: No Next.js Middleware (Route Protection Missing)

**File:** `apps/web/proxy.ts` (orphaned)
**Missing:** `apps/web/middleware.ts`

A `proxy.ts` file exists at the web app root that creates a Supabase server client, checks `getUser()`, and enforces:
- `/admin/*` routes require an authenticated user
- `/admin/*` routes require `role: "admin"` in `app_metadata` or `user_metadata`

**However, this file is never imported or exported as Next.js middleware.** There is no `middleware.ts` file anywhere in the web app. This means:
- No server-side auth protection on any route
- Unauthenticated users can access `/admin/*` directly
- The role check logic is dead code

### Issue 4: No API Routes Exist (All Admin Page Fetches 404)

**Missing:** `apps/web/app/api/**/*` (zero route files)
**Affected pages:**

| Page | API Endpoints Called | Status |
|------|---------------------|--------|
| `admin/beneficiaries/page.tsx` | `GET /api/beneficiaries`, `GET /api/beneficiaries/metrics`, `GET /api/chain/balance` | 404 |
| `admin/merchants/page.tsx` | `GET /api/merchants`, `GET /api/beneficiaries/metrics` | 404 |
| `admin/register/page.tsx` | `POST /api/beneficiaries/register`, `POST /api/merchants/register` | 404 |
| `components/admin/add-credits-modal.tsx` | `GET /api/chain/balance`, `PATCH /api/beneficiaries/:id/credits` | 404 |

The `apps/web/app/api/` directory contains only `.gitkeep` placeholder files. Every `fetch()` call in the admin pages will return 404, causing:
- Beneficiaries page: infinite loading spinner or empty table
- Merchants page: infinite loading spinner or empty table
- Registration form: "Registration failed" error on submit
- Add Credits modal: balance check fails

### Issue 5: Two Duplicate Login Pages (Confusion)

**File:** `apps/web/app/(auth)/login/page.tsx` — Supabase-based, react-hook-form + Zod, redirects to `/admin/beneficiaries`
**File:** `apps/web/app/admin/login/page.tsx` — Simulated auth (setTimeout), no Supabase, redirects to `/admin/dashboard`

Both exist. The root `page.tsx` redirects to `/login` which routes to the `(auth)/login` page. The `/admin/login` page is a separate legacy implementation that doesn't use Supabase at all (it just does `await new Promise(r => setTimeout(r, 1200))` and sets auth state).

### Issue 6: No Client-Side Auth Guard on Admin Routes

**File:** `apps/web/app/admin/layout.tsx`

The admin layout renders `AdminHeaderNav` and the page content, but performs **zero auth checks**. It only has a special case for `/admin/login` to render standalone. There is no:
- Check for Supabase session on mount
- Redirect to `/login` if unauthenticated
- Loading state while session is being verified

---

## Scope of Fix

Per user request: **Working login + placeholders**. Specifically:

1. ✅ Fix the login flow so authentication succeeds
2. ✅ Create placeholder/mock API routes so admin pages render with sample data
3. ✅ Add basic auth guard so unauthenticated users are redirected to login
4. ✅ Clean up the two duplicate login pages into one consistent flow
5. ❌ NOT building full backend API (deferred to future work)
6. ❌ NOT implementing Ronin/blockchain integration (deferred)

---

## Detailed Implementation Plan

### Step 1: Create Test Users in Supabase

**What:** Guide the user to create test users in Supabase Dashboard, or create a script/SQL to do it.

**Where:** `supabase/seed.sql` (update) + `supabase/setup-test-users.js` (already exists, check contents)

**Details:**
- Admin user: `admin@bantayog.test` / `TestPassword123!` with `raw_app_meta_data = {"role": "admin"}`
- Merchant user: `merchant@bantayog.test` / `TestPassword123!` with `raw_app_meta_data = {"role": "merchant"}`
- The `setup-test-users.js` file already exists at `supabase/setup-test-users.js` — read it first to see if it handles this

**Edge case:** If Supabase email confirmations are enabled in the hosted project, test users may need to be confirmed manually or via the dashboard.

### Step 2: Ensure Migration Is Run

**What:** Verify or run `00001_init_core_tables.sql` against the hosted Supabase project.

**Where:** `supabase/migrations/00001_init_core_tables.sql`

**Details:**
- If using hosted Supabase: run via SQL Editor in Dashboard
- If using local Supabase: run `supabase db reset` or `supabase migration up`
- Verify tables exist: `beneficiaries`, `merchants`, `transactions`, `products`, `qr_passes`
- Verify `has_role()` function exists
- Verify RLS policies are active

### Step 3: Create Next.js Middleware

**What:** Create `apps/web/middleware.ts` that wires up the existing `proxy.ts` logic.

**Where:** `apps/web/middleware.ts` (new file)

**Details:**
- Import and re-export the `proxy` function from `./proxy` as the default export
- Set `config.matcher` to exclude static assets, `_next/static`, `_next/image`, `favicon.ico`
- The proxy already handles:
  - Creating Supabase server client with cookie management
  - Checking `getUser()` for `/admin/*` routes
  - Redirecting unauthenticated users to `/login`
  - Returning 404 for non-admin users trying to access `/admin/*`

**Consideration:** The current `proxy.ts` redirects to `/login` for unauthenticated admin access. This needs to match the actual login route. The root `page.tsx` redirects to `/login`, and the `(auth)/login/page.tsx` handles that route. So the redirect target `/login` is correct.

### Step 4: Consolidate Login Pages

**What:** Remove the duplicate `/admin/login` page and ensure only the root `/login` (with Supabase) is used.

**Where:**
- `apps/web/app/admin/login/page.tsx` — remove or deprecate
- `apps/web/app/(auth)/login/page.tsx` — keep as the single login page
- `apps/web/app/page.tsx` — currently redirects to `/login` ✅ (already correct)
- `apps/web/app/admin/page.tsx` — currently redirects to `/admin/beneficiaries` ✅ (already correct)

**Details:**
- The `/admin/login` page uses simulated auth and doesn't call Supabase — it's a legacy artifact
- Remove it to avoid confusion
- The root `/login` page already handles:
  - Supabase `signInWithPassword` with Zod validation
  - Error handling (invalid credentials, network errors)
  - Redirect to `/admin/beneficiaries` on success

**Edge case:** If any bookmarks or external links point to `/admin/login`, add a redirect from `/admin/login` → `/login`.

### Step 5: Create Placeholder API Routes

**What:** Create minimal API route handlers that return mock/seed data so admin pages render.

**Where:** `apps/web/app/api/` directory (new files)

**Routes to create:**

1. **`apps/web/app/api/beneficiaries/route.ts`** — `GET` handler
   - Returns mock beneficiary data matching the `BeneficiaryRow` interface
   - Include 2–3 sample records with realistic Filipino names
   - Fields: `id`, `cardSerial`, `childName`, `guardianName`, `ageDetails`, `creditBalance`, `tier`, `birthdate`, `jwsCompact`

2. **`apps/web/app/api/beneficiaries/metrics/route.ts`** — `GET` handler
   - Returns `{ totalBeneficiaries, criticalUnits, allocatedPhpc, verifiedMerchants }`
   - Compute from mock data (don't hardcode — derive counts)

3. **`apps/web/app/api/beneficiaries/[id]/credits/route.ts`** — `PATCH` handler
   - Accepts `{ amount: number }` in body
   - Returns success response (mock — doesn't persist)

4. **`apps/web/app/api/beneficiaries/register/route.ts`** — `POST` handler
   - Accepts registration payload
   - Returns mock `QrPassData` response with generated card serial

5. **`apps/web/app/api/merchants/route.ts`** — `GET` handler
   - Returns mock merchant data matching `MerchantRow` interface
   - Include 2–3 sample records

6. **`apps/web/app/api/merchants/register/route.ts`** — `POST` handler
   - Accepts registration payload
   - Returns success response

7. **`apps/web/app/api/chain/balance/route.ts`** — `GET` handler
   - Returns `{ formatted: "1250.00", balance: 1250 }` (mock PHPC balance)

**Implementation approach:** Use `NextResponse.json()` with hardcoded mock data. Each route should be self-contained (no database calls). Add comments indicating these are placeholders to be replaced with real Supabase/Hono API calls.

### Step 6: Add Client-Side Auth Guard to Admin Layout

**What:** Add a session check in the admin layout that redirects unauthenticated users.

**Where:** `apps/web/app/admin/layout.tsx`

**Details:**
- Create a Supabase browser client (reuse the pattern from login page)
- On mount, call `supabase.auth.getSession()`
- If no session, redirect to `/login`
- Show a loading spinner while checking
- This is a belt-and-suspenders approach alongside the middleware

**Consideration:** The middleware (Step 3) already handles server-side protection. This client-side check handles:
- Direct URL navigation after session expires
- Browser back-button scenarios
- Cases where middleware might be bypassed (e.g., client-side navigation)

### Step 7: Verify .env.local Configuration

**What:** Ensure `apps/web/.env.local` has the correct Supabase credentials.

**Where:** `apps/web/.env.local`

**Verified values:**
- `NEXT_PUBLIC_SUPABASE_URL=https://erpxfpbrxthfpvtfcfqz.supabase.co` ✅ (confirmed from code search)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — needs to be verified (file was blocked from reading)

**Additional env vars needed for middleware:**
- The middleware uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same as browser client) — these are already configured

---

## Files to Modify/Create

| Action | File | Purpose |
|--------|------|---------|
| Create | `apps/web/middleware.ts` | Wire up proxy.ts as Next.js middleware |
| Create | `apps/web/app/api/beneficiaries/route.ts` | Mock GET /api/beneficiaries |
| Create | `apps/web/app/api/beneficiaries/metrics/route.ts` | Mock GET /api/beneficiaries/metrics |
| Create | `apps/web/app/api/beneficiaries/[id]/credits/route.ts` | Mock PATCH /api/beneficiaries/:id/credits |
| Create | `apps/web/app/api/beneficiaries/register/route.ts` | Mock POST /api/beneficiaries/register |
| Create | `apps/web/app/api/merchants/route.ts` | Mock GET /api/merchants |
| Create | `apps/web/app/api/merchants/register/route.ts` | Mock POST /api/merchants/register |
| Create | `apps/web/app/api/chain/balance/route.ts` | Mock GET /api/chain/balance |
| Modify | `apps/web/app/admin/layout.tsx` | Add client-side auth guard |
| Modify | `supabase/seed.sql` | Add instructions or SQL for test user creation |
| Delete/Redirect | `apps/web/app/admin/login/page.tsx` | Remove duplicate login page |

---

## Verification Plan

After implementation, verify the following flow works end-to-end:

1. **Navigate to `localhost:3000`** → redirects to `/login`
2. **Login with `admin@bantayog.test` / `TestPassword123!`** → authenticates via Supabase, redirects to `/admin/beneficiaries`
3. **`/admin/beneficiaries`** → shows StatusBar, 4 metric cards, and a table with 2–3 mock beneficiary records
4. **`/admin/merchants`** → shows StatusBar, metric cards, and a table with 2–3 mock merchant records
5. **`/admin/register`** → both registration forms render and submit successfully (mock responses)
6. **Logout / clear session** → navigating to `/admin/*` redirects back to `/login`
7. **TypeScript check** → `pnpm type-check` passes with no errors in `apps/web`
8. **Dev server** → `pnpm dev` starts without build errors

---

## Known Limitations / Deferred Work

1. **No real API persistence** — all mock routes return hardcoded data; changes don't persist
2. **No Supabase RLS integration** — mock routes bypass RLS entirely
3. **No middleware role differentiation** — admin and merchant portals not separated
4. **No session refresh** — Supabase session may expire without automatic refresh
5. **No registration flow** — test users must be created manually in Supabase Dashboard
6. **Backend API (apps/server)** — the Hono server is out of scope for this fix
7. **Blockchain/Ronin integration** — deferred to future phases

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase email confirmations enabled | Test users can't login until confirmed | Guide user to disable confirmations in Dashboard or confirm users manually |
| .env.local has wrong anon key | All Supabase calls fail | Verify key matches Supabase Dashboard > Settings > API |
| Migration not run | Tables don't exist, RLS fails | Run migration before testing; verify via Supabase SQL Editor |
| Mock data doesn't match component interfaces | Pages crash on render | Mock data shapes must exactly match `BeneficiaryRow`, `MerchantRow`, `Metrics`, `QrPassData` interfaces |
