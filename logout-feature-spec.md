# Sign Out / Back to Login — Feature Specification

## 1. Overview

**Request:** Users cannot return to the login page after entering the admin dashboards. A "Sign Out" action is needed to allow authenticated admin users to exit back to the login page.

**Scope:** Admin section (`/admin/*`) only — not applicable to merchant pages.

---

## 2. Placement

| Property | Value |
|---|---|
| **Location** | `AdminHeaderNav` component (`apps/web/components/admin/header-nav.tsx`) |
| **Position** | After the "MERCHANTS" nav link, as the last item in the right-side nav row |
| **Type** | Icon-only button (no text label) |

---

## 3. Visual Design

### Icon
- **Shape:** Exit / door-arrow icon (an open door with an arrow pointing outward)
- **Style:** Same visual treatment as other nav links: `text-brand-darkTeal/70` default, `hover:text-brand-darkTeal hover:bg-brand-sageBg/40` on hover
- **Size:** ~18×18px (matching the scale of other nav elements)
- **SVG source:** A `<svg>` door/exit icon inline (no external icon library)

### Layout
- Positioned after "MERCHANTS" link in the `<nav>` element
- No divider or pipe separator needed — just a subtle gap
- No tooltip on hover (the icon should be self-explanatory)

### Active state
- No active/highlighted state needed (there is no route for "sign out")
- Should show hover state transition same as nav links

---

## 4. Behavior

### Click Flow

1. User clicks the Sign Out icon button in the header nav
2. A **confirmation modal** appears (not immediate sign-out)
3. User clicks **Confirm** → sign out executes
4. User clicks **Cancel** or clicks outside / presses Escape → modal dismisses, no action

### Sign Out Execution

| Step | Action |
|---|---|
| 1 | Call `logout()` from `useAuth()` context → resets auth state to `initialState` (portal: "lgu", status: "idle", walletConnected: false, username: "") |
| 2 | Call `router.push("/login")` to navigate to the login page |
| 3 | Do **not** call `supabase.auth.signOut()` — session handling is client-side only |

### Post-Sign-Out State
- Auth context resets to idle
- User lands on `/login` page
- Subsequent access to `/admin/*` will be blocked by the admin layout's auth guard (`router.replace("/login")`)

---

## 5. Confirmation Modal

### Trigger
Clicking the Sign Out icon opens a modal dialog.

### Modal Properties
| Property | Value |
|---|---|
| **Title** | "Sign Out" (with a small exit/door icon next to it) |
| **Body text** | "Are you sure you want to sign out? You will be redirected to the login page." |
| **Confirm button** | "Sign Out" — coral/destructive color (`bg-brand-coral` / `hover:bg-brand-coralHover`) |
| **Cancel button** | "Cancel" — neutral style |
| **Dismiss** | Click outside overlay, press Escape, or click Cancel |
| **Animation** | Fade-in overlay + scale-up modal (consistent with existing modals in the app) |

### Modal Implementation
- Can be a lightweight inline component within `AdminHeaderNav` (not a separate file)
- Uses a simple `useState<boolean>` for open/close
- Rendered as a portal overlay at the bottom of `AdminHeaderNav` or via a shared modal wrapper if one exists
- Follows the same visual patterns as `QrPassModal`, `AddCreditsModal`, `MerchantConfirmationModal`

---

## 6. Files to Modify

| File | Change |
|---|---|
| `apps/web/components/admin/header-nav.tsx` | Add Sign Out icon button + confirmation modal logic + import `useAuth` and `useRouter` |
| `apps/web/app/admin/beneficiaries/page.tsx` | No change needed |
| `apps/web/app/admin/merchants/page.tsx` | No change needed |
| `apps/web/app/admin/register/page.tsx` | No change needed |
| `apps/web/app/admin/dashboard/page.tsx` | No change needed |
| `apps/web/app/admin/registry/page.tsx` | No change needed |

**Key insight:** Only `header-nav.tsx` needs to change since it's the persistent component across all admin pages.

---

## 7. Implementation Notes

### Dependencies
- `useAuth` from `@/stores/auth-context` (already imported in admin layout)
- `useRouter` from `next/navigation`
- No new package installations needed

### Import additions in `header-nav.tsx`
```tsx
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth-context";
import { useState } from "react";
```

### State additions
```tsx
const [showSignOutModal, setShowSignOutModal] = useState(false);
```

### Router + auth hooks
```tsx
const router = useRouter();
const { logout } = useAuth();
```

### Sign Out handler
```tsx
const handleSignOut = () => {
  logout();
  router.push("/login");
  setShowSignOutModal(false);
};
```

### CSS / Styling
- The icon button should match the nav link styling: pill-shaped rounded-full, same typography scale
- Since it's icon-only, use `px-3` or `w-9 h-9` centered layout instead of `px-4 py-2`
- Use existing brand colors: `brand-darkTeal`, `brand-sageBg`, `brand-coral`, `brand-coralHover`

### Edge Cases
- **Already on login page:** No issue — the admin layout won't render `AdminHeaderNav` when pathname is `/admin/login`
- **Rapid double-click:** Modal will be open, second click is ignored
- **Slow network:** No network call involved (client-side only), so no loading state needed
- **Session already expired:** Sign out still works gracefully — `logout()` resets client state regardless

---

## 8. Acceptance Criteria

- [ ] A door/exit icon is visible in the admin header nav, positioned after "MERCHANTS"
- [ ] Clicking the icon opens a confirmation modal with exit icon + message + Sign Out / Cancel buttons
- [ ] Clicking "Sign Out" clears auth context and redirects to `/login`
- [ ] Clicking "Cancel" closes the modal without action
- [ ] The icon has proper hover state matching nav link style
- [ ] No tooltip appears on hover
- [ ] Works on all admin pages (register, beneficiaries, merchants, dashboard, registry)
- [ ] Does not appear on non-admin pages
- [ ] No server-side Supabase session invalidation is triggered

---

## 9. Future Considerations (Out of Scope)

- Sign Out from merchant pages (deferred per user decision)
- Server-side session revocation
- "Sign Out from all devices" option
- Analytics / audit logging for sign-out events
