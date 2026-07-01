# BANTAYOG — Login Page Fix & Refactor Spec

> **Spec Owner:** Buffy (AI Assistant)
> **Date:** July 1, 2026
> **Status:** Draft

---

## 1. Problem Statement

### 1.1 Authentication Error

Users navigating to the root login page (`/login`) and attempting to authenticate with their own credentials receive a UI error banner:

> **"Invalid email or password. Please check your credentials and try again."**

### 1.2 Root Cause

- **No Supabase users exist** — the Supabase project has been configured (URL + anon key in `.env.local`) but:
  - The database migration (`supabase/migrations/00001_init_core_tables.sql`) has **not been run**
  - No test users have been created in the Supabase Authentication dashboard
  - The `setup-test-users.js` script has not been executed
- The dev bypass credentials (`admin@bantayog.gov.ph` / `bantayog2026`) exist in code but the user **never tried them** — they used their own credentials instead
- Since `signInWithPassword()` fails (no matching user in Supabase `auth.users`), the error is caught and displayed in the red error banner

### 1.3 UI/UX Issues

- Heavy use of **inline styles** instead of CSS classes from `globals.css` (e.g., `.input-field`, `.card`, `.animate-fade-in`, `.badge`)
- Logo incorrectly references `/adminAssets/title.svg` — should be `/adminAssets/title.png`
- Button text is "Authenticate and Enter" (title case) but spec requires "AUTHENTICATE AND ENTER" (all caps)
- **LGU Portal Indicator Bar** missing — a dark teal bar with building icon + "LGU Portal" text above the form
- **Footer bar** exists but should match spec background `#FFEBE5` (already correct)
- Successful login redirects to `/admin/beneficiaries` — should redirect to `/admin/registration`

---

## 2. Scope of Work

| # | Task | Description |
|---|------|-------------|
| 1 | **Fix dev bypass** | Ensure the dev bypass authentication path is reliable and well-documented. The user explicitly chose **dev bypass only** (no Supabase user creation). |
| 2 | **Refactor to CSS classes** | Replace inline styles with pre-defined Tailwind classes and globals.css utility classes (`.input-field`, `.card`, `.badge`, `.animate-fade-in`, `.animate-slide-in-right`, etc.) |
| 3 | **Fix logo asset** | Change `title.svg` → `title.png` in the Image component. Remove all references to SVG format for the logo. |
| 4 | **Update button text** | Change "Authenticate and Enter" → "AUTHENTICATE AND ENTER" with a right chevron (>) icon at the end. |
| 5 | **Update redirect target** | Change `router.push("/admin/beneficiaries")` → `router.push("/admin/registration")` |
| 6 | **Add LGU Portal Indicator Bar** | Ensure the dark teal (`#003E39`) indicator bar with building icon + "LGU Portal" text is present above the form |
| 7 | **Verify footer** | Confirm footer matches spec: `#FFEBE5` background, centered copyright text (already implemented correctly) |

### Out of Scope

- ❌ Creating Supabase users / running `setup-test-users.js`
- ❌ Adding "Forgot Password" or "Remember Me" — user explicitly declined
- ❌ Building real backend API routes (deferred to future work)
- ❌ Implementing Ronin/blockchain integration
- ❌ Adding session persistence / session refresh logic

---

## 3. Design & UI Specification

### 3.1 Global Theme & Color Palette

| Element | Color Role | Hex Code |
|---------|-----------|----------|
| Main Background | Canvas Base | `#FFD2C4` (Soft Coral / Peach) |
| Footer Bar | Section Accent | `#FFEBE5` (Light Cream-Peach) |
| Primary Brand Text | Typography & Dark Accents | `#003E39` (Deep Forest Teal) |
| Accent Orange / Borders | CTA Button & Input Outlines | `#F18F76` (Warm Salmon / Terracotta) |
| Card Fill | Component Container | `#FFFFFF` (Pure White) & `#FDF2EE` (Warm Off-White) |

### 3.2 Layout

**Structure:** Two-column split layout
- **Breakpoint:** Single column on mobile (`grid-cols-1`), side-by-side on desktop (`lg:grid-cols-2`)
- **Padding:** `px-8 py-10 lg:px-16 lg:py-12`
- **Alignment:** Vertically centered (`items-center`)

**Left Column (Hero & Branding):**
1. **DOH Badge** — Capsule pill with shield icon + "DOH Supported Social Initiative" text, thin border, rounded-full
2. **BANTAYOG Logo** — Uses `/adminAssets/title.png` (NOT SVG), large display image, `max-w-[420px]`
3. **Hero Paragraph** — Deep teal text, `max-w-2xl`, medium weight, `leading-relaxed`
4. **Feature Highlight Cards (×2)** — Side-by-side (`flex-row gap-4`), white bg, rounded-xl, icon box (w-12 h-12), bold title + tiny description text

**Right Column (Login Card):**
1. **Portal Access Card** — `max-w-[480px]`, bg `#FDF2EE`, `rounded-[2rem]`, warm shadow, inner padding `p-10`
2. **Card Header** — "Gateway Portal Access" title + "Select your portal pathway and authenticate" subtitle
3. **LGU Portal Indicator Bar** — Full width, `h-12`, bg `#003E39`, white building icon + "LGU Portal" text, `rounded-md`
4. **Form Fields** — Email (or username) + Password
5. **CTA Button** — "AUTHENTICATE AND ENTER" full width, bg `#F18F76`, bold deep teal text, chevron icon
6. **Dev Hint Banner** — Shows bypass credentials in development, styled as a subtle info box

### 3.3 Form Field Specifications

| Property | Value |
|----------|-------|
| Label style | `text-[10px] font-bold uppercase tracking-wider mb-2`, color `#003E39` |
| Input height | `h-12` |
| Input border | `1.5px solid #F18F76` (default), `1.5px solid #003E39` (focus), `1.5px solid #DC2626` (error) |
| Input border-radius | `rounded-xl` |
| Input bg | `#FFFFFF` |
| Input text color | `#003E39` |
| Focus ring | `0 0 0 3px rgba(3,62,57,0.08)` |
| Error text | `text-xs font-semibold ml-1`, color `#DC2626` |

### 3.4 CTA Button Specifications

| Property | Value |
|----------|-------|
| Text | "AUTHENTICATE AND ENTER" |
| Height | `h-14` |
| Background | `#F18F76` (Warm Salmon/Terracotta) |
| Text color | `#003E39` |
| Font | `font-bold text-sm uppercase tracking-wider` |
| Border-radius | `rounded-xl` |
| Icon | Right chevron (`>`) at end of text |
| Loading state | Animated spinner replaces text content |
| Hover | `#e8795f` (darker salmon) |
| Shadow | `0 4px 20px rgba(241,143,118,0.4)` |
| Disabled | `opacity-60 cursor-not-allowed` |

### 3.5 Error States

| State | Appearance |
|-------|-----------|
| **Auth error** (invalid creds) | Red banner: bg `#FDE8E8`, border `1px solid rgba(220,60,60,0.2)`, text `#B91C1C`, ⚠ prefix |
| **Network error** | Same red banner, different message |
| **Too many attempts** | Same red banner, rate-limit message |
| **Input validation** | Red border on input field + red error text below |
| **Loading** | Spinner icon replacing button text, button disabled |

### 3.6 Animation Classes (from globals.css)

| Element | Animation Class |
|---------|---------------|
| Left column | `.animate-fade-in` |
| Right column | `.animate-slide-in-right` |
| Error banner appearance | `.animate-fade-in` |
| Card content | `.stagger-children` (optional) |

### 3.7 Footer Bar

- Height: `h-14`
- Background: `#FFEBE5`
- Text: "© 2026 BANTAYOG. All rights reserved."
- Text style: `text-[10px] sm:text-xs font-medium`, color `#494949`

---

## 4. Authentication Flow

### 4.1 Dev Bypass Flow (Primary Path)

```
User enters credentials → Submit
  ↓
Check: NODE_ENV !== "production"
  AND email === "admin@bantayog.gov.ph"
  AND password === "bantayog2026"
  ↓
[Match] → setUsername(email) → authenticate() → router.push("/admin/registration")
[No match] → Try Supabase signInWithPassword (will fail)
```

### 4.2 Supabase Flow (Fallback)

```
Dev bypass didn't match → Try supabase.auth.signInWithPassword(email, password)
  ↓
[Success] → setUsername(email) → authenticate() → router.push("/admin/registration")
[Error] → Parse error type → Display appropriate error banner
```

### 4.3 Error Message Mapping

| Supabase Error | User-Facing Message |
|---------------|-------------------|
| "invalid_credentials" | "Invalid email or password. Please check your credentials and try again." |
| "Email not confirmed" | "Invalid email or password. Please check your credentials and try again." |
| "too many requests" | "Too many login attempts. Please wait a moment before trying again." |
| Network error | "Network error. Please check your connection and try again." |

### 4.4 Auth Context Actions

| Action | Effect |
|--------|--------|
| `setUsername(email)` | Sets the username in AuthState |
| `authenticate()` | Sets status to "authenticated" (or "loading-merchant" if portal === "merchant") |
| `logout()` | Resets AuthState to initial values |

---

## 5. Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/web/app/(auth)/login/page.tsx` | **Modify** | Refactor inline styles to CSS classes, fix logo (svg→png), update button text, update redirect, verify LGU indicator bar and footer |
| `apps/web/app/admin/register/page.tsx` | **No change needed** | Already exists at this path, just updating the redirect target |

### Files to Reference

- `apps/web/app/globals.css` — CSS classes to reuse
- `apps/web/stores/auth-context.tsx` — Auth state management
- `apps/web/app/admin/layout.tsx` — Session checking (already redirects to `/login`)
- `apps/web/app/admin/adminAssets/title.png` — The actual logo asset

---

## 6. Implementation Plan

### Step 1: Fix Logo Asset Reference
- Change `src="/adminAssets/title.svg"` → `src="/adminAssets/title.png"`
- Verify the Image component and ensure `alt="BANTAYOG"` is preserved
- Remove any reference to SVG format for the logo

### Step 2: Refactor Inline Styles to CSS Classes
Replace inline `style={{}}` objects with Tailwind utility classes and globals.css classes:

**Replacement mapping:**

| Inline Style | CSS Class |
|-------------|-----------|
| `style={{ backgroundColor: "#FFD2C4" }}` | `style={{ backgroundColor: "#FFD2C4" }}` (keep — custom color) |
| `style={{ border: "...", backgroundColor: "..." }}` on DOH badge | Tailwind classes: `border border-[rgba(3,62,57,0.25)]` + `bg-white/35` |
| `style={{ color: "#003E39" }}` | `text-[#003E39]` |
| `style={{ color: "rgba(3,62,57,0.7)" }}` | `text-[rgba(3,62,57,0.7)]` |
| `style={{ backgroundColor: "#FFFFFF", boxShadow: "..." }}` on cards | Use `.card` from globals.css or `bg-white shadow-sm` |
| Input field styles | Use `.input-field` from globals.css where applicable, or `bg-white h-12 rounded-xl px-4 text-sm outline-none border-2 border-[#F18F76]` |
| Error banner styles | Tailwind: `bg-red-50 border border-red-200 text-red-700` |
| Button styles | Tailwind: `bg-[#F18F76] hover:bg-[#e8795f] text-[#003E39] font-bold text-sm uppercase tracking-wider h-14 rounded-xl` |
| Footer styles | `bg-[#FFEBE5] h-14 flex items-center justify-center` |

**Animations to use:**
- Left column: `animate-fade-in`
- Right column: `animate-slide-in-right`

### Step 3: Update Button Text
- Change `"Authenticate and Enter"` → `"AUTHENTICATE AND ENTER"`
- Ensure the right chevron (`>`) icon is at the end
- Keep loading spinner implementation for loading state

### Step 4: Update Redirect Target
- Find all `router.push("/admin/beneficiaries")` occurrences
- Change to `router.push("/admin/registration")`

### Step 5: Verify LGU Portal Indicator Bar
- Confirm the dark teal bar with building icon + "LGU Portal" text is present
- It should be `rounded-md`, `h-12`, bg `#003E39`, between the card header and form fields

### Step 6: Verify Dev Bypass Logic
- Ensure the dev bypass works correctly:
  ```typescript
  if (
    process.env.NODE_ENV !== "production" &&
    email === "admin@bantayog.gov.ph" &&
    password === "bantayog2026"
  ) {
    setUsername(email);
    authenticate();
    router.push("/admin/registration");
    return;
  }
  ```
- Keep the dev hint banner visible in development

### Step 7: Clean Up Unused Code
- Remove any unused imports or variables after refactoring
- Ensure all imports from react-hook-form, zod, supabase/ssr are still needed and used

### Step 8: Verification Checklist
- [ ] Dev bypass works with `admin@bantayog.gov.ph` / `bantayog2026`
- [ ] Wrong credentials in dev bypass show error banner
- [ ] Button shows loading spinner when submitting
- [ ] Logo renders correctly from `/adminAssets/title.png`
- [ ] All inline styles replaced with CSS classes where possible
- [ ] Button text is "AUTHENTICATE AND ENTER" with chevron
- [ ] Redirect goes to `/admin/registration`
- [ ] LGU Portal Indicator Bar is present
- [ ] No TypeScript errors
- [ ] No unused imports remain

---

## 7. Verification Plan

1. **Start dev server:** `cd apps/web && pnpm dev`
2. **Navigate to** `http://localhost:3000` → should redirect to `/login`
3. **Enter dev bypass credentials** (`admin@bantayog.gov.ph` / `bantayog2026`) → should authenticate and redirect to `/admin/registration`
4. **Enter wrong credentials** → should show red error banner with "Invalid email or password"
5. **Check browser DevTools** → no console errors
6. **Run type check:** `cd apps/web && pnpm type-check` → no errors
7. **Visual check:** Login page matches spec layout, colors, and spacing

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Refactoring inline styles breaks layout | Visual regressions | Test after each change; compare against spec screenshot |
| Dev bypass stops working after refactor | Cannot log in | Test dev bypass before and after changes |
| CSS class replacement misses spacing | Layout looks off | Do side-by-side comparison with current page |
| Removing unused imports causes build errors | TypeScript errors | Run `pnpm type-check` after changes |

---

## 9. Known Limitations

1. **No real authentication** — only the dev bypass works; Supabase auth will fail because no users exist
2. **No session persistence** — refreshing the page after dev bypass login will redirect back to login
3. **Admin layout already checks for Supabase session** — after dev bypass login, navigating to `/admin/*` may redirect back to login because there's no real Supabase session
4. **The admin layout's session check** (`apps/web/app/admin/layout.tsx`) uses `supabase.auth.getSession()` which will return null — this means after successful dev bypass redirect, the admin layout may redirect back to `/login`

> **Note on Limitation #3-4:** After fixing the login page and dev bypass, the admin layout's session guard will still redirect unauthenticated users because it checks for a real Supabase session. To fully enable dev workflow, the admin layout's session check may also need to be bypassed in development mode. This is noted but **out of scope** for this refactor unless the user requests it.
