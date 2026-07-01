"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth-context";

/* ─────────────────────────────────────────────────────────
   AdminHeaderNav — persistent top bar across all /admin/* routes
   Logo + "Prototype" badge + university subtext on the left.
   Registration | Beneficiaries | Merchants links on the right.
   Active route highlighted with a pill background.
   ───────────────────────────────────────────────────────── */

const navLinks = [
  { href: "/admin/register", label: "REGISTRATION" },
  { href: "/admin/beneficiaries", label: "BENEFICIARIES" },
  { href: "/admin/merchants", label: "MERCHANTS" },
] as const;

export function AdminHeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOut = () => {
    logout();
    router.push("/login");
    setShowSignOutModal(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-brand-sageBorder/30" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <div className="max-w-[1280px] mx-auto px-6 h-[72px] flex items-center justify-between gap-4">

        {/* ── Left: Logo + wordmark + badge + subtext ── */}
        <Link href="/admin/beneficiaries" className="flex items-center gap-3 select-none">
          {/* Logo mark — SVG from public/adminAssets */}
          <div className="w-12 h-12 flex-shrink-0">
            <Image
              src="/adminAssets/1.svg"
              alt="Bantayog logo"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>

          {/* Wordmark + badge + subtext */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-black tracking-tight text-brand-darkTeal leading-none">
                BANTAYOG
              </span>
              {/* "Prototype" badge — grey pill sampled from mock */}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#c8c8c8]/60 text-[#555] border border-[#bbb]/40 leading-none">
                Prototype
              </span>
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-brand-darkTeal/50 mt-0.5 leading-none">
              Polytechnic University of the Philippines
            </span>
          </div>
        </Link>

        {/* ── Right: Navigation links + Sign Out ── */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href ||
              (href === "/admin/beneficiaries" && pathname === "/admin");

            return (
              <Link
                key={href}
                href={href}
                className={`
                  px-4 py-2 rounded-full text-[11px] font-bold tracking-wider
                  transition-all duration-200 select-none
                  ${isActive
                    ? "bg-brand-darkTeal text-white shadow-sm"
                    : "text-brand-darkTeal/70 hover:text-brand-darkTeal hover:bg-brand-sageBg/40"
                  }
                `}
              >
                {label}
              </Link>
            );
          })}

          {/* Sign Out icon button */}
          <button
            onClick={() => setShowSignOutModal(true)}
            className="ml-2 w-9 h-9 rounded-full flex items-center justify-center text-brand-darkTeal/60 hover:text-brand-darkTeal hover:bg-brand-sageBg/40 transition-all duration-200 select-none cursor-pointer"
            aria-label="Sign Out"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </nav>
      </div>

      {/* Thin separator line below header */}
      <div className="h-[3px] bg-gradient-to-r from-brand-sageBorder/20 via-brand-sageBorder/50 to-brand-sageBorder/20" />

      {/* ═══════════════════════════════════════
         Sign Out Confirmation Modal
         ═══════════════════════════════════════ */}
      {showSignOutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          style={{ backgroundColor: "rgba(3,62,57,0.25)" }}
          onClick={() => setShowSignOutModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand-coral/10 flex items-center justify-center text-brand-coral flex-shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-brand-darkTeal">Sign Out</h2>
            </div>

            {/* Body text */}
            <p className="text-sm text-brand-darkTeal/70 leading-relaxed mb-6 ml-[52px]">
              Are you sure you want to sign out? You will be redirected to the login page.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowSignOutModal(false)}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-brand-darkTeal/70 hover:text-brand-darkTeal hover:bg-brand-sageBg/40 transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-brand-coral hover:bg-brand-coralHover transition-all duration-200 cursor-pointer shadow-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
