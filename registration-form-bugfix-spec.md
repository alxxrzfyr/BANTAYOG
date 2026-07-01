# Registration Form Bug Fix — Specification

## 1. Overview

Fix three isolated bugs in the Bantayog Admin registration form components:

| ID | Bug | Component | Target |
|----|-----|-----------|--------|
| B1 | Duplicate PIN input (two stacked input layers) | `beneficiary-registration-form.tsx` | Remove redundant visible `<input>` |
| B2 | Missing form reset lifecycle | Both forms | Wire `form.reset()` per form-specific rules |
| B3 | Missing/broken `autoComplete` attributes | Both forms | Add `autoComplete` on PIN + wallet fields |

## 2. Scope — Files to Modify

| File | Changes |
|------|---------|
| `apps/web/components/admin/beneficiary-registration-form.tsx` | B1, B2, B3 |
| `apps/web/components/admin/merchant-registration-form.tsx` | B2, B3 |
| `apps/web/app/admin/register/page.tsx` | None |

**Not modified:** `qr-pass-modal.tsx`, `merchant-verified-toast.tsx`, `status-bar.tsx`, or any other file.

## 3. Design Constraints

- **No new npm dependencies.** `react-hook-form` and `@hookform/resolvers/zod` are already in use — no other state library.
- **Do not touch styling, layout, or color tokens.** Existing Tailwind classes (`border-brand-sageBorder`, `text-brand-darkTeal`, `text-brand-coral`, `bg-brand-darkTeal`, etc.) remain untouched. No token redefinition.
- **Preserve existing tokens.** Trust the codebase's token set — do not overwrite working tokens to match external hex values.
- **Two independent `useForm()` instances** — one per form card, never shared.

---

## 4. Fix B1 — Duplicate PIN Input (Guardian-Child card only)

### 4.1 Current State

The PIN block in `beneficiary-registration-form.tsx` currently renders **three** elements:

1. **`renderPinDots()`** — A visual dot display (groups of 3 circles, filled/unfilled). This is the "dot-mask" display.
2. **Hidden `<input type="password">`** — `className="sr-only"`, `tabIndex={-1}`, `aria-hidden="true"`, bound to `{...register("pin")}`. This is the controlled form element.
3. **Visible `<input type="number">`** — Placeholder `"Enter 4–6 digit PIN"`, uses `onChange` + `setValue("pin", ...)` to update the form value.

### 4.2 Fix

1. **Delete** element #3 (the visible `type="number"` input with placeholder `"Enter 4–6 digit PIN"`).
2. **Keep** element #1 (`renderPinDots()`) as the visual dot-mask display.
3. **Keep** element #2 (hidden `sr-only` input) as the controlled form element, bound to `register("pin")`.
4. **Add a visibility-toggle icon/button** next to or inside the dot-display container. Clicking toggles between dot display (masked) and showing the actual PIN digits in plain text. Use the same eye/hide icon pattern from the Merchant form's password fields.
5. **Update PIN Zod schema**: change from `.min(4, ...).max(12, ...)` to `.length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must be numeric only")`.
6. **Update `maxLength`** on the hidden input from `6` to `6` (already correct).
7. **Confirm** there is exactly one `pin`-related `<input>` in the JSX output (the hidden `sr-only` one). No other key like `pinConfirm` exists in the schema — confirmed clean.

### 4.3 End State

```
Create Your PIN label
├── [dot-mask display — renderPinDots with eye toggle button]
├── [hidden sr-only <input type="password" maxLength={6} {...register("pin")} />]
└── [error message for pin, if any]
```

- Exactly one `<input>` for the PIN field.
- The eye toggle switches the dot display between filled circles (masked) and the actual digit text.
- Error message still renders below the dot display.

---

## 5. Fix B2 — Form State & Reset Lifecycle

### 5.1 Beneficiary Form (`beneficiary-registration-form.tsx`)

#### 5.1.1 What to Add

Destructure `reset` from `useForm()`:
```typescript
const {
  register,
  handleSubmit,
  watch,
  setValue,
  reset,                  // <-- ADD
  formState: { errors },
} = useForm<FormValues>({ ... });
```

#### 5.1.2 Submit Success Behavior

- On `200`/`201` response from `POST /api/beneficiaries/register`:
  1. Capture returned payload (signed JWT).
  2. Build `QrPassData` from response (existing logic).
  3. Call `onSuccess(qrData)` to open QR Pass modal.
  4. **Do NOT call `form.reset()` here** — fields remain populated while modal is open.

#### 5.1.3 Reset Triggering

- `form.reset()` fires **only** from the QR modal's close handlers (✕ button + backdrop overlay click).
- Mechanism: The page component (`register/page.tsx`) already passes `onClose={() => setQrPassOpen(false)}` to `QrPassModal`. Pass an additional `onReset` callback down to the beneficiary form, which calls:
  ```typescript
  reset();                    // clear form fields
  setAlertBanner(null);       // clear alert
  setApiError(null);          // clear error
  ```
- Wire this so that when `qrPassOpen` transitions to `false`, the reset fires. This can be done via a `useEffect` in the form component watching a `shouldReset` boolean prop, or by passing a callback directly.
- Both close paths (✕ + backdrop) must call the same single function — no duplication.

#### 5.1.4 Submit Error Behavior

- On network error or non-2xx response: **do NOT reset the form**.
- Show inline error via `setApiError(msg)` (existing logic).
- Preserve every field value exactly as typed.

### 5.2 Merchant Form (`merchant-registration-form.tsx`)

#### 5.2.1 What to Add

Destructure `reset` from `useForm()`:
```typescript
const {
  register,
  handleSubmit,
  reset,                    // <-- ADD
  formState: { errors },
} = useForm<FormValues>({ ... });
```

#### 5.2.2 Submit Success Behavior

- On successful response from `POST /api/merchants/register`:
  1. Call `onSuccess()` (triggers `setToastOpen(true)` in page).
  2. Immediately after `onSuccess()`, call `form.reset()`.
  3. Also clear `setApiError(null)`.
- Both `onSuccess()` and `reset()` fire in the same success handler — reset is not deferred.

#### 5.2.3 Submit Error Behavior

- On network error or non-2xx response: **do NOT reset the form**.
- Show inline error via `setApiError(msg)` (existing logic).
- Preserve field values.

---

## 6. Fix B3 — Input Hygiene (autoComplete)

### 6.1 Beneficiary Form

| Field | `autoComplete` value |
|-------|----------------------|
| PIN hidden input (`sr-only`) | `"one-time-code"` |
| Any other field | No change (default browser behavior is acceptable) |

### 6.2 Merchant Form

| Field | `autoComplete` value |
|-------|----------------------|
| Wallet Address | `"off"` |
| Password | `"new-password"` (suppress saved-password suggestions) |
| Confirm Password | `"new-password"` (same reason) |
| Any other field (store name, owner name, phone) | No change |

### 6.3 Rationale

- `"one-time-code"` signals the browser this is a short-lived code typically received via SMS — appropriate for a PIN field used to generate a QR pass.
- `"off"` on wallet address prevents the browser from suggesting saved form values (credit card numbers, addresses, etc.) that visually overlap with the wallet input.
- `"new-password"` on both password fields prevents the browser from filling in existing saved passwords instead of prompting for a new one.

---

## 7. Verification Checklist

- [ ] B1: Exactly one `<input>` for PIN in the Beneficiary form's JSX output.
- [ ] B1: Zod schema enforces exactly 6 digits (`z.string().length(6)`).
- [ ] B1: Eye toggle button added to PIN dot display, visually matches merchant password eye icons.
- [ ] B2 (Beneficiary): `form.reset()` NOT called at submit-success — fields stay populated.
- [ ] B2 (Beneficiary): `form.reset()` called on QR modal close (✕ + backdrop) — clears fields + alertBanner + apiError.
- [ ] B2 (Beneficiary): On failed submit, form NOT reset, inline error shown.
- [ ] B2 (Merchant): `form.reset()` called immediately after `onSuccess()` in the same handler.
- [ ] B2 (Merchant): On failed submit, form NOT reset, inline error shown.
- [ ] B3: Hidden PIN input has `autoComplete="one-time-code"`.
- [ ] B3: Wallet address input has `autoComplete="off"`.
- [ ] B3: Password fields have `autoComplete="new-password"`.
- [ ] B3: No blanket `autoComplete="off"` on all inputs — scoped to affected fields only.
- [ ] No styling, layout, color token, or non-bug-related code was changed.
- [ ] QR Pass modal internals were not touched.
- [ ] Merchant Verified Toast internals were not touched.

---

## 8. Implementation Notes

### 8.1 Reset Wiring for Beneficiary Form

The page (`register/page.tsx`) already holds `qrPassOpen` state. Options:

**Preferred approach:** Pass a `resetKey` counter prop from the page to the beneficiary form. The page increments it in its `onClose` handler. The form uses a `useEffect` watching `resetKey` to call `reset()`, `setAlertBanner(null)`, `setApiError(null)`.

**Alternative:** The page passes an `onReset` callback function that the beneficiary form provides during mount. The page calls it inside `onClose` alongside `setQrPassOpen(false)`. This keeps the reset logic in the form component.

Both approaches use a single function for both close paths.

### 8.2 Visibility Toggle Implementation

Add a `showPin` state (default `false`). When `false`, render dot circles as currently done. When `true`, render the actual digits from `pinValue` in plain text (same layout/gaps, but digit characters instead of circles).

Toggle button: positioned to the right of or inside the dot container, using the same eye/hide SVG icons as in `merchant-registration-form.tsx`.

### 8.3 PIN Max Length

The hidden input already has `maxLength={6}`. The Zod schema will enforce exactly 6 (`z.string().length(6)`). The `inputMode="numeric"` attribute should remain to trigger the numeric keyboard on mobile.

---

## 9. Glossary

| Term | Definition |
|------|------------|
| Beneficiary form | `BeneficiaryRegistrationForm` component — left card, registers Guardian-Child units |
| Merchant form | `MerchantRegistrationForm` component — right card, registers merchant units |
| QrPassModal | Modal showing the generated QR code pass with child/guardian info |
| MerchantVerifiedToast | Success overlay toast for merchant registration |
| dot-mask | Visual display of filled/unfilled circles representing PIN digits |
| visibility toggle | Eye icon button that shows/hides the actual PIN digits |
