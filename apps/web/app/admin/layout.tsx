"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/stores/auth-context";

/* ───────────────────────────────────────────
   Admin Layout — Sidebar navigation shell
   ─────────────────────────────────────────── */

const navItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    href: "/admin/registry",
    label: "Registry",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { state, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[var(--color-border-light)] px-4 py-3 flex items-center justify-between">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-extrabold gradient-text">BANTAYOG</span>
          <span className="badge bg-[var(--color-primary-50)] text-[var(--color-primary-600)] text-[10px] font-bold px-2 py-0.5">
            ADMIN
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </header>

      <div className="flex">
        {/* Sidebar — Desktop */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-white border-r border-[var(--color-border-light)] shadow-sm sticky top-0">
          {/* Brand */}
          <div className="p-6 border-b border-[var(--color-border-light)]">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <span className="text-2xl font-extrabold gradient-text">BANTAYOG</span>
              <span className="badge bg-[var(--color-primary-50)] text-[var(--color-primary-600)] text-[10px] font-bold">
                ADMIN
              </span>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                    ${
                      isActive
                        ? "bg-[var(--color-primary-50)] text-[var(--color-primary-600)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary-500)]"
                    }
                  `}
                >
                  <span className={isActive ? "text-[var(--color-primary-500)]" : ""}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--color-border-light)]">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-surface-muted)]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-500)] flex items-center justify-center text-white text-sm font-bold">
                {state.username.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {state.username || "Admin User"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">LGU Portal</p>
              </div>
              <button
                onClick={logout}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                aria-label="Logout"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="lg:hidden fixed top-0 left-0 z-40 w-64 h-full bg-white shadow-2xl animate-slide-in-right">
              <div className="p-6 border-b border-[var(--color-border-light)] flex items-center justify-between">
                <span className="text-2xl font-extrabold gradient-text">BANTAYOG</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                        ${
                          isActive
                            ? "bg-[var(--color-primary-50)] text-[var(--color-primary-600)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                        }
                      `}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className="page-container py-6 md:py-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
