# Design Token Pass — Bantayog Registration Page

## Objective

Apply exact hex-based design tokens to the Bantayog admin registration page and related components. This is a **color-token-only** pass — no changes to spacing, layout, component structure, copy, or element additions/removals.

---

## Scope

### Files to modify

| File | Role |
|---|---|
| `apps/web/app/admin/register/page.tsx` | Registration page (orchestrates both forms + modals) |
| `apps/web/components/admin/beneficiary-registration-form.tsx` | Left card — "Register Guardian-Child Unit" |
| `apps/web/components/admin/merchant-registration-form.tsx` | Right card — "Register Merchant Unit" |
| `apps/web/components/admin/header-nav.tsx` | Top navbar (active route pill, navbar background) |
| `apps/web/components/admin/status-bar.tsx` | Status bar ("Database Online" pill) |
| `apps/web/app/admin/layout.tsx` | Admin layout (page canvas background, body styles) |
| `apps/web/app/globals.css` | Tailwind v4 theme (`@theme` block) + CSS custom properties |

### Token table

| Token name | Hex | Applied to |
|---|---|---|
| `brand-teal` | `#004B49` | Headers (`h2` card headings), text labels, primary button backgrounds ("Onboard & Generate QR ID", "Onboard"). **Replaces** existing `brand-darkTeal` value. |
| `bg-canvas` | `#FAC5B9` | Page background. **Replaces** existing `--color-canvas` CSS variable value. |
| `bg-navbar` | `#FDEFEA` | Top navbar (`header-nav.tsx`) background. |
| `bg-card` | `#FFF9F8` | Form card container backgrounds (both registration cards). **Replaces** current `bg-white`. |
| `border-input` | `#F3B3A3` | All text input borders (child name, guardian name, birthdate, income, PIN, store name, owner name, phone wrapper, wallet, passwords). Also applied to card borders. |
| `badge-status-bg` | `#B9CFCF` | "Database Online" indicator capsule background in `status-bar.tsx`. |
| `alert-bg` | `#FEECE8` | Critical 1,000-Day Window Alert banner background. |
| `alert-border` | `#FCA390` | Alert banner border. |
| `alert-text` | `#FF3B30` | Alert banner warning icon + text color. |
| `route-active-bg` | `#D9C6C1` | Active nav-link capsule background in `header-nav.tsx`. |
| `route-active-text` | `#E07A65` | Active nav-link text color in `header-nav.tsx`. |

---

## Detailed token application rules

### 1. `brand-teal` (#004B49) — Replace existing `brand-darkTeal`

**Action:** In `globals.css`, overwrite the `--color-brand-darkTeal` value from `#034c52` to `#004B49`.

This token already has widespread usage via `text-brand-darkTeal`, `bg-brand-darkTeal`, etc. By overwriting the CSS variable, all existing references automatically pick up the new color.

**Elements that use this token (no class changes needed — they already reference `brand-darkTeal`):**
- Card headings (`h2` in both forms)
- Form label text — **BUT**: labels currently use `text-brand-coral`. Per user decision, labels should switch to `text-brand-darkTeal` (which now resolves to `#004B49`).
- Submit button backgrounds (`bg-brand-darkTeal`) — now resolves to `#004B49`
- Submit button text (white on dark teal)
- Input text color (`text-brand-darkTeal`)
- Various icon colors referencing `text-brand-darkTeal/60`, `text-brand-darkTeal/30`, etc.

**Label color change:** Change `text-brand-coral` → `text-brand-darkTeal` on all form labels in both `beneficiary-registration-form.tsx` and `merchant-registration-form.tsx`.

### 2. `bg-canvas` (#FAC5B9) — Page background

**Action:** In `globals.css`, overwrite `--color-canvas` from `#fdf2ed` to `#FAC5B9`.

The layout (`layout.tsx`) already uses `style={{ backgroundColor: "var(--color-canvas)" }}`, so it will automatically pick up the new value. No layout changes needed.

### 3. `bg-navbar` (#FDEFEA) — Navbar background

**Action:** In `header-nav.tsx`, change the header background from `style={{ backgroundColor: 'var(--color-canvas)' }}` to use the new Tailwind token class `bg-bg-navbar`.

This decouples the navbar background from the page canvas.

### 4. `bg-card` (#FFF9F8) — Form card backgrounds

**Action:** In both `beneficiary-registration-form.tsx` and `merchant-registration-form.tsx`, replace `bg-white` with `bg-bg-card` on the outer card `<div>`.

**Current:** `className="bg-white rounded-2xl p-7 border border-brand-sageBorder/30 shadow-sm h-full"`
**New:** `className="bg-bg-card rounded-2xl p-7 border border-brand-sageBorder/30 shadow-sm h-full"`

### 5. `border-input` (#F3B3A3) — Input borders + card borders

**Action:** Replace `border-brand-sageBorder` with `border-border-input` on all input fields across both forms. Also replace `border-brand-sageBorder/30` on card container borders.

**Beneficiary form — inputs to update (5 total):**
1. Child Name input: `border-brand-sageBorder` → `border-border-input`
2. Guardian Name input: `border-brand-sageBorder` → `border-border-input`
3. Birthdate input: `border-brand-sageBorder` → `border-border-input`
4. Monthly Income input: `border-brand-sageBorder` → `border-border-input`
5. PIN input: currently has hardcoded `border-[#F3B3A3]` → change to `border-border-input`

**Merchant form — inputs to update (7 total):**
1. Store Name input: `border-brand-sageBorder` → `border-border-input`
2. Owner Name input: `border-brand-sageBorder` → `border-border-input`
3. Phone number wrapper: `border-brand-sageBorder` → `border-border-input`
4. Wallet Address input: `border-brand-sageBorder` → `border-border-input`
5. Create Password input: `border-brand-sageBorder` → `border-border-input`
6. Confirm Password input: `border-brand-sageBorder` → `border-border-input`
7. Phone prefix pill inner border: `border-brand-sageBorder/40` → `border-border-input/40`

**Card borders (3 files):**
- Beneficiary form card: `border-brand-sageBorder/30` → `border-border-input/30`
- Merchant form card: `border-brand-sageBorder/30` → `border-border-input/30`
- Status bar card: `border-brand-sageBorder/30` → `border-border-input/30`

**Note:** The `inputClass` helper in `merchant-registration-form.tsx` centralizes input border logic. Update it there to affect all merchant inputs at once.

**Focus/error states:** Leave `focus:border-brand-activeTeal` and `border-red-400` unchanged per user decision.

### 6. `badge-status-bg` (#B9CFCF) — Database Online pill

**Action:** In `status-bar.tsx`, replace the hardcoded `bg-[#e8f4f4]` with `bg-badge-status-bg` on the "Database Online" pill container.

**Current:** `bg-[#e8f4f4] border-brand-sageBorder/50 text-brand-darkTeal`
**New:** `bg-badge-status-bg border-brand-sageBorder/50 text-brand-darkTeal`

### 7. `alert-bg` (#FEECE8) + `alert-border` (#FCA390) + `alert-text` (#FF3B30) — Alert banner

**Action:** In `beneficiary-registration-form.tsx`, replace the alert banner styling.

**Current:**
```
<div className="flex items-start gap-3 bg-brand-coral/10 border border-brand-coral/30 rounded-xl px-4 py-3">
  <span className="text-brand-coral mt-0.5 flex-shrink-0">
    <svg ... className="text-brand-coral">
  </span>
  <p className="text-xs font-semibold text-brand-coral leading-relaxed">
```

**New:**
```
<div className="flex items-start gap-3 bg-alert-bg border border-alert-border rounded-xl px-4 py-3">
  <span className="text-alert-text mt-0.5 flex-shrink-0">
    <svg ... className="text-alert-text">
  </span>
  <p className="text-xs font-semibold text-alert-text leading-relaxed">
```

### 8. `route-active-bg` (#D9C6C1) + `route-active-text` (#E07A65) — Active nav link

**Action:** In `header-nav.tsx`, update the active nav link styling.

**Current (active state):** `bg-brand-darkTeal text-white shadow-sm`
**New (active state):** `bg-route-active-bg text-route-active-text shadow-sm`

**Inactive state:** Leave unchanged (`text-brand-darkTeal/70 hover:text-brand-darkTeal hover:bg-brand-sageBg/40`).

---

## Hardcoded hex values to remove

These inline hex values currently exist in the code and should be replaced with the new tokens:

| File | Current value | Replace with |
|---|---|---|
| `beneficiary-registration-form.tsx` | `text-[#004B49]` (PIN label) | `text-brand-darkTeal` (now resolves to `#004B49`) |
| `beneficiary-registration-form.tsx` | `border-[#F3B3A3]` (PIN input) | `border-border-input` |

---

## Tailwind theme declaration (globals.css `@theme` block)

Add these new tokens to the `@theme` block:

```css
/* — Registration page design tokens — */
--color-brand-teal: #004B49;
--color-bg-canvas: #FAC5B9;
--color-bg-navbar: #FDEFEA;
--color-bg-card: #FFF9F8;
--color-border-input: #F3B3A3;
--color-badge-status-bg: #B9CFCF;
--color-alert-bg: #FEECE8;
--color-alert-border: #FCA390;
--color-alert-text: #FF3B30;
--color-route-active-bg: #D9C6C1;
--color-route-active-text: #E07A65;
```

**Note:** In Tailwind v4, `--color-bg-canvas` in the `@theme` block generates the utility `bg-bg-canvas`. Similarly, `--color-border-input` generates `border-border-input`.

---

## CSS variable update (globals.css `:root` block)

Overwrite the canvas color variable:

```css
/* Before */
--color-canvas: #fdf2ed;

/* After */
--color-canvas: #FAC5B9;
```

Also overwrite `brand-darkTeal` in the `@theme` block:

```css
/* Before */
--color-brand-darkTeal: #034c52;

/* After */
--color-brand-darkTeal: #004B49;
```

---

## Self-check checklist

| # | Token | Element | File | Status |
|---|---|---|---|---|
| 1 | `brand-teal` (#004B49) | Card headings (`h2`) | beneficiary + merchant forms | ⬜ Already uses `text-brand-darkTeal` — value overwritten |
| 2 | `brand-teal` (#004B49) | Form labels | beneficiary + merchant forms | ⬜ Change `text-brand-coral` → `text-brand-darkTeal` |
| 3 | `brand-teal` (#004B49) | Submit button bg | both forms | ⬜ Already uses `bg-brand-darkTeal` — value overwritten |
| 4 | `bg-canvas` (#FAC5B9) | Page background | layout.tsx + globals.css | ⬜ Overwrite `--color-canvas` |
| 5 | `bg-navbar` (#FDEFEA) | Navbar background | header-nav.tsx | ⬜ Change `var(--color-canvas)` → `bg-bg-navbar` |
| 6 | `bg-card` (#FFF9F8) | Form card bg | both forms | ⬜ Change `bg-white` → `bg-bg-card` |
| 7 | `border-input` (#F3B3A3) | Input borders (all) | both forms | ⬜ Change `border-brand-sageBorder` → `border-border-input` |
| 8 | `border-input` (#F3B3A3) | Card borders | both forms + status-bar | ⬜ Change `border-brand-sageBorder/30` → `border-border-input/30` |
| 9 | `badge-status-bg` (#B9CFCF) | Database Online pill bg | status-bar.tsx | ⬜ Change `bg-[#e8f4f4]` → `bg-badge-status-bg` |
| 10 | `alert-bg` (#FEECE8) | Alert banner bg | beneficiary form | ⬜ Change `bg-brand-coral/10` → `bg-alert-bg` |
| 11 | `alert-border` (#FCA390) | Alert banner border | beneficiary form | ⬜ Change `border-brand-coral/30` → `border-alert-border` |
| 12 | `alert-text` (#FF3B30) | Alert icon + text | beneficiary form | ⬜ Change `text-brand-coral` → `text-alert-text` |
| 13 | `route-active-bg` (#D9C6C1) | Active nav pill bg | header-nav.tsx | ⬜ Change `bg-brand-darkTeal` → `bg-route-active-bg` |
| 14 | `route-active-text` (#E07A65) | Active nav pill text | header-nav.tsx | ⬜ Change `text-white` → `text-route-active-text` |

---

## Constraints

1. **No layout changes** — spacing, grid, padding, margins, flex/gap all stay identical.
2. **No structural changes** — no elements added, removed, or reordered.
3. **No copy changes** — all text content stays the same.
4. **No new components** — only existing files are modified.
5. **Focus/error states untouched** — `focus:border-brand-activeTeal` and `border-red-400` remain as-is.
6. **Elements not in the token table** — keep their current colors (icons, placeholder text, skeleton states, etc.).
7. **All token names used in classNames** — no hardcoded hex strings in JSX after the pass.
