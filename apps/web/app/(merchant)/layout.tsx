"use client";

import Link from "next/link";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[var(--color-border-light)] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/merchant/login" className="flex items-center gap-2">
            <span className="text-xl font-extrabold gradient-text">BANTAYOG</span>
            <span className="badge bg-[var(--color-accent-light)] text-[var(--color-accent-hover)] text-[10px] font-bold px-2 py-0.5">
              MERCHANT
            </span>
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
