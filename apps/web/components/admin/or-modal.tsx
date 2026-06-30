"use client";

import { useEffect, useState } from "react";

/* ───────────────────────────────────────────
   Slide 4 — Merchant Confirmation View
   Success modal/overlay triggered post-merchant submit
   ─────────────────────────────────────────── */

interface MerchantConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  merchantName: string;
  ownerName: string;
  barangay: string;
}

export function MerchantConfirmationModal({
  open,
  onClose,
  merchantName,
  ownerName,
  barangay,
}: MerchantConfirmationModalProps) {
  const [merchantHash, setMerchantHash] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Generate a deterministic-looking hash ID
      const hash = Array.from({ length: 16 }, () =>
        "0123456789abcdef"[Math.floor(Math.random() * 16)]
      ).join("");
      setMerchantHash(`M-${hash.toUpperCase()}`);
      return;
    }
    const timer = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Merchant Confirmation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-lg transition-all duration-300 ${
          open ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        <div className="card p-8 md:p-10 text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center animate-scale-in">
              <svg
                className="w-10 h-10 text-[var(--color-success)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>

          {/* Verified Badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] text-sm font-bold border border-[var(--color-success)]/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              VERIFIED MERCHANT
            </span>
          </div>

          {/* Confirmation Message */}
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[var(--color-text-primary)]">
              Merchant Onboarded Successfully!
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
              <span className="font-bold text-[var(--color-text-primary)]">
                {merchantName}
              </span>{" "}
              owned by{" "}
              <span className="font-bold text-[var(--color-text-primary)]">
                {ownerName}
              </span>{" "}
              in {barangay} has been fully processed and verified.
            </p>
          </div>

          {/* Hash ID */}
          <div className="inline-block px-5 py-3 rounded-2xl bg-[var(--color-surface-muted)] border border-[var(--color-border-light)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Merchant Hash ID
            </p>
            <p className="text-lg font-mono font-bold text-[var(--color-primary-500)] tracking-wider">
              {merchantHash}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-light)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Status
              </p>
              <p className="text-sm font-bold text-[var(--color-success)] mt-0.5">
                Verified &amp; Active
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-light)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Wallet
              </p>
              <p className="text-sm font-bold text-[var(--color-primary-500)] mt-0.5 font-mono text-xs">
                0x{Math.random().toString(16).slice(2, 10)}...
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-light)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                PHPC Subsidy
              </p>
              <p className="text-sm font-bold text-[var(--color-primary-500)] mt-0.5">
                5,000.00 PHPC
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-light)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Timestamp
              </p>
              <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
                {new Date().toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 px-6 rounded-xl bg-[var(--color-primary-500)] text-white font-bold text-sm hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)] transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer active:scale-[0.98]"
          >
            Return to Dashboard
          </button>

          {/* Sub note */}
          <p className="text-xs text-[var(--color-text-muted)]">
            The merchant can now accept PHPC-subsidized payments via their BANTAYOG Merchant Portal.
          </p>
        </div>
      </div>
    </div>
  );
}
