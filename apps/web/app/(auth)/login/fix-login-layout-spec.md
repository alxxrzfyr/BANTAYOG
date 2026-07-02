# Fix Branding Block Spacing — Bantayog Login Page

## Target file
`apps/web/app/(auth)/login/page.tsx` — edit only this file.

## Reference (correct spacing)
`/adminAssets/1.png` — the wordmark, DOH pill, and tagline are tightly grouped as one visual unit.

## Confirmed bug
In the left branding column, three elements — the "DOH Supported Social Initiative" pill, the BANTAYOG wordmark, and the tagline paragraph — currently sit far apart vertically, inheriting large gaps (`gap-6` = 24px) from the outer column layout. In `1.png` these three are tightly grouped as one visual unit.

### Current structure (broken)
```
<div className="flex flex-col items-start gap-6">          ← gap-6 applied uniformly to ALL children
  {/* DOH Badge */}                                         ← gap-6 before wordmark
  {/* BANTAYOG Logo / Title */}                             ← gap-6 before paragraph
  {/* Hero Paragraph */}                                    ← gap-6 before feature cards
  {/* Feature Highlight Cards */}                           ← has its own mt-2 adding extra space
</div>
```

The uniform `gap-6` spacing between the badge → wordmark → paragraph → feature cards causes the branding elements to appear disconnected rather than grouped.

---

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Inner branding gap | `gap-y-3` mobile → `gap-y-4` desktop | Tight grouping matches 1.png reference; responsive to prevent overcrowding on small screens |
| Section gap (branding ↔ cards) | `gap-y-6` mobile → `gap-y-10` desktop | Clearly separates the branding group from the feature cards section |
| Wordmark wrapper max-width | None (keep current full-width) | The image naturally constrains via column width |
| Feature cards mt-2 | Remove | Let the parent gap control spacing between branding block and cards |
| Outer div alignment | `items-start justify-start` | Branding block should top-align in the column |
| Inner branding wrapper max-width | None | Let the wrapper fill its column width naturally |
| Scope of inner wrapper | Only: DOH pill, wordmark image, tagline paragraph | Feature cards remain as siblings outside the wrapper |

---

## Fix specification

### Step 1 — Wrap the branding block

Wrap the three branding elements (DOH pill, wordmark, hero paragraph) in their own `<div>` container. This isolates them from the outer column's gap.

```jsx
{/* Branding block — tightly grouped */}
<div className="flex flex-col items-start gap-y-3 sm:gap-y-4">
  {/* DOH Badge */}
  ...
  {/* BANTAYOG Logo / Title */}
  ...
  {/* Hero Paragraph */}
  ...
</div>
```

**Gap classes:**
- `gap-y-3` (12px) on mobile (default)
- `sm:gap-y-4` (16px) on `sm` breakpoint and above

**No max-width** on this inner wrapper — it should fill the column width naturally.

### Step 2 — Ensure no rogue margins on children

Check each of the three children for any margin/padding utilities that could override the parent gap:

| Element | Current classes | Action |
|---------|----------------|--------|
| DOH Badge | `inline-flex items-center gap-2 rounded-full px-4 py-1.5` | No change — no rogue margins |
| Wordmark wrapper | `w-full max-w-[5000px]` | No change — no rogue margins |
| Hero Paragraph | `text-sm sm:text-base leading-relaxed max-w-2xl font-medium text-[#003E39]` | No change — no rogue margins |

All spacing between these three children must come **only** from the parent's `gap-y-*`, not from any `my-*`, `mt-*`, `mb-*`, `py-*`, or `pt-*` utilities on the children.

### Step 3 — Remove mt-2 from feature cards container

The feature cards wrapper currently has `mt-2` which adds extra margin. Remove it:

```jsx
{/* BEFORE */}
<div className="flex flex-col sm:flex-row gap-4 mt-2 w-full max-w-lg">

{/* AFTER */}
<div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
```

### Step 4 — Update outer column container spacing

The outer left-column `<div>` currently has `gap-6` (24px) uniform spacing. After the fix, this gap now applies between:
1. The new branding block wrapper
2. The feature cards container

Update the outer container to use responsive gaps:

```jsx
{/* BEFORE */}
<div className="flex flex-col items-start gap-6 animate-fade-in">

{/* AFTER */}
<div className="flex flex-col items-start gap-y-6 sm:gap-y-10 animate-fade-in">
```

**Gap classes:**
- `gap-y-6` (24px) on mobile
- `sm:gap-y-10` (40px) on `sm` breakpoint and above

This creates a clearly larger visual separation between the branding group and the feature cards, distinct from the tight internal spacing of the branding block.

---

## Final structure (after fix)

```
<main className="flex-1 grid grid-cols-1 lg:grid-cols-2 items-center px-8 py-10 lg:px-16 lg:py-12 gap-10 lg:gap-0">

  {/* ─── LEFT COLUMN ─── */}
  <div className="flex flex-col items-start gap-y-6 sm:gap-y-10 animate-fade-in">

    {/* Branding block — tightly grouped */}
    <div className="flex flex-col items-start gap-y-3 sm:gap-y-4">
      {/* DOH Badge */}
      {/* BANTAYOG Logo / Title */}
      {/* Hero Paragraph */}
    </div>

    {/* Feature Highlight Cards (mt-2 REMOVED) */}
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
      {/* Card 1 — LGU Beneficiary Registry */}
      {/* Card 2 — AI Merchant Verification */}
    </div>

  </div>

  {/* ─── RIGHT COLUMN — Login Card (unchanged) ─── */}
  ...

</main>
```

---

## What NOT to change

- ❌ The wordmark image size (`max-w-[5000px]`, `width={1000}`, `height={5000}`)
- ❌ The DOH pill styling (border, background, icon, text)
- ❌ The tagline paragraph copy, font size, or weight
- ❌ The feature cards' content, styling, or layout
- ❌ The right-side login card (form, inputs, button, portal indicator)
- ❌ The footer
- ❌ Input styling or form logic
- ❌ The outer `<main>` layout classes
- ❌ Animation classes (`animate-fade-in`, `animate-slide-in-right`)

---

## Self-check

Compare against `1.png`:
- ✅ Pill, wordmark, and tagline read as one tightly-grouped block
- ✅ Consistent small gaps (`gap-y-3`/`gap-y-4`) between the three elements
- ✅ A clearly larger gap (`gap-y-6`/`gap-y-10`) separates that block from the two feature cards below
- ✅ No rogue margins on individual children — all spacing is controlled by parent gaps
- ✅ Responsive: slightly tighter on mobile, proper spacing on desktop
- ✅ No changes to unrelated elements (form, footer, right column, card styles)
