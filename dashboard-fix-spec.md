# BANTAYOG — Admin Dashboard 404 Fix Spec

> **Spec Owner:** Buffy (AI Assistant)
> **Date:** July 1, 2026
> **Status:** Draft

---

## 1. Problem Statement

### 1.1 The Error

After successfully authenticating (via dev bypass or Supabase auth), users are redirected to `/admin/registration` and see a **Next.js 404 "This page could not be found"** error. The browser URL bar shows `/admin/registration`.

The same issue may affect the **beneficiaries** and **merchants** pages when navigated to via the header nav — but these have not been tested yet.

### 1.2 Root Cause

**Primary cause — Wrong redirect path in login page:**

The login page (`apps/web/app/(auth)/login/page.tsx`) redirects to `/admin/registration` (with "ion"), but the actual page is at `/admin/register` (without "ion").

```
File system:  apps/web/app/admin/register/page.tsx    ✅ Exists
Redirect to:  /admin/registration                       ❌ Does not exist → 404
```

This affects both auth paths:
- **Dev bypass** (`admin@bantayog.gov.ph` / `bantayog2026`)
- **Supabase auth** (after creating test users via `setup-test-users.js`)

**Secondary issues discovered:**

| # | Issue | File | Details |
|---|-------|------|---------|
| 1 | **Header nav typo** | `header-nav.tsx` | "BENIFICIARIES" should be "BENEFICIARIES" |
| 2 | **Admin landing redirect** | `admin/page.tsx` | `/admin` → `/admin/beneficiaries`, should → `/admin/register` to match the new landing page |
| 3 | **Header nav links vs login redirect** | `header-nav.tsx` | Nav links to `/admin/register` (correct), but login redirects to `/admin/registration` (wrong) |

---

## 2. Scope of Work

| # | Task | File | Change |
|---|------|------|--------|
| 1 | **Fix login redirect** | `apps/web/app/(auth)/login/page.tsx` | Change `router.push("/admin/registration")` → `router.push("/admin/register")` (2 occurrences) |
| 2 | **Fix admin landing redirect** | `apps/web/app/admin/page.tsx` | Change `redirect("/admin/beneficiaries")` → `redirect("/admin/register")` |
| 3 | **Fix header nav typo** | `apps/web/components/admin/header-nav.tsx` | Change "BENIFICIARIES" → "BENEFICIARIES" |
| 4 | **Verify all admin pages load correctly** | Multiple | Navigate to /admin/register, /admin/beneficiaries, /admin/merchants, /admin/dashboard — confirm no 404s or infinite loading |
| 5 | **Run type-check** | — | `npx tsc --noEmit` in `apps/web` |
| 6 | **Code review** | — | Spawn code-reviewer-deepseek-flash |

### 2.1 Out of Scope

- ❌ Fixing mock API data to render correctly in tables (they already have mock data)
- ❌ Adding new pages or routes
- ❌ Renaming/moving files
- ❌ Changing the registration form or merchant form behavior
- ❌ Creating Supabase database tables (migrations deferred)

---

## 3. Detailed Change Specifications

### 3.1 Fix Login Redirect

**File:** `apps/web/app/(auth)/login/page.tsx`

**Current (broken):**
```typescript
// Line ~42 (dev bypass path)
router.push("/admin/registration");

// Line ~72 (Supabase auth path)
router.push("/admin/registration");
```

**Target:**
```typescript
router.push("/admin/register");
```

Both occurrences must be changed. The page at `/admin/register` contains:
- `StatusBar` component
- `BeneficiaryRegistrationForm` (left card)
- `MerchantRegistrationForm` (right card)
- `QrPassModal` (opens on beneficiary form success)
- `MerchantVerifiedToast` (opens on merchant form success)

### 3.2 Fix Admin Landing Redirect

**File:** `apps/web/app/admin/page.tsx`

**Current:**
```typescript
export default function AdminPage() {
  redirect("/admin/beneficiaries");
}
```

**Target:**
```typescript
export default function AdminPage() {
  redirect("/admin/register");
}
```

This ensures that navigating to `/admin` (the root admin route) goes to the registration page, which is the designated landing page after login.

### 3.3 Fix Header Nav Typo

**File:** `apps/web/components/admin/header-nav.tsx`

**Current:**
```typescript
{ href: "/admin/beneficiaries", label: "BENIFICIARIES" },
```

**Target:**
```typescript
{ href: "/admin/beneficiaries", label: "BENEFICIARIES" },
```

This is purely cosmetic but ensures the nav matches standard spelling.

### 3.4 Routes & Files Reference

| Route | File Path | Status |
|-------|-----------|--------|
| `/admin` | `apps/web/app/admin/page.tsx` | ✅ Redirects to `/admin/beneficiaries` — **will be updated to `/admin/register`** |
| `/admin/register` | `apps/web/app/admin/register/page.tsx` | ✅ Exists — registration forms landing |
| `/admin/beneficiaries` | `apps/web/app/admin/beneficiaries/page.tsx` | ✅ Exists — beneficiary table |
| `/admin/merchants` | `apps/web/app/admin/merchants/page.tsx` | ✅ Exists — merchant table |
| `/admin/dashboard` | `apps/web/app/admin/dashboard/page.tsx` | ✅ Exists — old dashboard (not linked in nav) |
| `/admin/login` | `apps/web/app/admin/login/page.tsx` | ✅ Exists — legacy, redirects to `/login` |
| `/admin/registry` | `apps/web/app/admin/registry/page.tsx` | ✅ Exists — old registry page (not linked in nav) |
| `/admin/registration` | ❌ **Does not exist** | This is the broken redirect target |

### 3.5 API Routes (Data Sources for Admin Pages)

| API Route | File | Data |
|-----------|------|------|
| `GET /api/beneficiaries` | `apps/web/app/api/beneficiaries/route.ts` | Mock beneficiary list (5 records) |
| `GET /api/beneficiaries/metrics` | `apps/web/app/api/beneficiaries/metrics/route.ts` | Mock metrics |
| `POST /api/beneficiaries/register` | `apps/web/app/api/beneficiaries/register/route.ts` | Mock registration response |
| `PATCH /api/beneficiaries/[id]/credits` | `apps/web/app/api/beneficiaries/[id]/credits/route.ts` | Mock credit add |
| `GET /api/merchants` | `apps/web/app/api/merchants/route.ts` | Mock merchant list |
| `POST /api/merchants/register` | `apps/web/app/api/merchants/register/route.ts` | Mock merchant registration |
| `GET /api/chain/balance` | `apps/web/app/api/chain/balance/route.ts` | Mock PHPC balance |

All API routes exist with mock data. The admin pages fetch from these on mount and should render correctly after the redirect fix.

---

## 4. Implementation Plan

### Step 1: Fix Login Redirect (2 occurrences)
- Open `apps/web/app/(auth)/login/page.tsx`
- Find both `router.push("/admin/registration")` calls
- Change both to `router.push("/admin/register")`

### Step 2: Fix Admin Landing Redirect
- Open `apps/web/app/admin/page.tsx`
- Change `redirect("/admin/beneficiaries")` → `redirect("/admin/register")`

### Step 3: Fix Header Nav Typo
- Open `apps/web/components/admin/header-nav.tsx`
- Change `"BENIFICIARIES"` → `"BENEFICIARIES"`

### Step 4: Verify Admin Pages
- Start the dev server: `cd apps/web && pnpm dev`
- Navigate to `http://localhost:3000` → should redirect to `/login`
- Log in with dev bypass credentials (`admin@bantayog.gov.ph` / `bantayog2026`)
- **Verify:** Redirected to `/admin/register` — should show StatusBar + two registration forms side by side
- Click "BENEFICIARIES" in nav — should show beneficiary table with 5 mock records and metric cards
- Click "MERCHANTS" in nav — should show merchant table with 3 mock records and metric cards
- Click "/admin/dashboard" directly — should show the old dashboard page
- Check browser console for any JavaScript errors

### Step 5: Run Type-Check
```bash
cd apps/web && npx tsc --noEmit
```
Should pass with zero errors.

### Step 6: Code Review
Spawn `code-reviewer-deepseek-flash` to review the changes.

---

## 5. Files to Modify

| File | Change | Risk |
|------|--------|------|
| `apps/web/app/(auth)/login/page.tsx` | Change redirect target (2x) | Low — string change only |
| `apps/web/app/admin/page.tsx` | Change redirect target | Low — string change only |
| `apps/web/components/admin/header-nav.tsx` | Fix typo | Low — string change only |

---

## 6. Verification Checklist

- [ ] Login redirects to `/admin/register` (not `/admin/registration`)
- [ ] `/admin/register` page renders: StatusBar + Beneficiary form + Merchant form
- [ ] Registration forms submit and show success states (QR modal, merchant toast)
- [ ] `/admin/beneficiaries` page renders: StatusBar + metric cards + table with 5 rows
- [ ] `/admin/merchants` page renders: StatusBar + metric cards + table with 3 rows
- [ ] Header nav shows "BENEFICIARIES" (correct spelling)
- [ ] No 404 pages when navigating between admin routes
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No console errors in browser DevTools

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Admin layout still redirects to `/login` after dev bypass | Auth flow broken | Already fixed in previous session — checks `authState.status === "authenticated"` |
| Mock API routes return `ok: false` for some fetch calls | Tables show loading spinner forever | Verify fetch responses in browser DevTools |
| Typo fix in nav causes `usePathname()` mismatch | Active nav pill doesn't highlight | The `pathname === href` check uses the href path, not the label — so typo fix won't affect routing |

---

## 8. Session History Context

### Already Completed (Previous Sessions)

1. **Login page refactored** — Inline styles → Tailwind classes, logo svg→png, button text updated, redirect set to `/admin/registration`
2. **Logo fix** — `title.png` copied from `app/admin/adminAssets/` to `public/adminAssets/`
3. **Admin layout timeout** — Added 3-second timeout to `getSession()` call
4. **Dev bypass in admin layout** — Added `authState.status === "authenticated"` check to skip Supabase session check
5. **Test users created** — `admin@bantayog.test` / `TestPassword123!` and `merchant@bantayog.test` / `TestPassword123!` via `setup-test-users.js`

### Pending (This Session)

1. ❌ Fix login redirect `/admin/registration` → `/admin/register`
2. ❌ Fix admin landing redirect `/admin/beneficiaries` → `/admin/register`
3. ❌ Fix nav typo "BENIFICIARIES" → "BENEFICIARIES"
4. ❌ Verify all admin pages work
