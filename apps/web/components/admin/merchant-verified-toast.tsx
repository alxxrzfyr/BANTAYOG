"use client";

import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────
   MerchantVerifiedToast — mock 5.png
   Dark teal/sage overlay card with:
   – Large coral checkmark circle
   – "CONGRATS! You are now a Verified Merchant." in coral/white
   – ✕ close button top-right
   Auto-dismisses after 4 seconds.
   ───────────────────────────────────────────────────────── */

interface MerchantVerifiedToastProps {
  open: boolean;
  onClose: () => void;
}

export function MerchantVerifiedToast({
  open,
  onClose,
}: MerchantVerifiedToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      /* Auto-dismiss after 4 seconds */
      timerRef.current = setTimeout(onClose, 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Merchant verified"
    >
      {/* Translucent backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Toast card — dark teal/sage muted background, matching mock 5.png */}
      <div className="relative w-full max-w-md rounded-[1.75rem] bg-brand-activeTeal/80 backdrop-blur-md px-10 py-10 flex flex-col items-center gap-5 text-center animate-scale-in shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/30 transition-all cursor-pointer"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Coral checkmark circle */}
        <div className="w-20 h-20 rounded-full border-4 border-brand-coral flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-coral"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Message */}
        <p className="text-brand-coral font-extrabold text-xl leading-snug">
          CONGRATS! You are now a Verified Merchant.
        </p>

        {/* Auto-dismiss progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-[1.75rem] overflow-hidden">
          <div
            className="h-full bg-brand-coral/60"
            style={{
              animation: "shrink 4s linear forwards",
            }}
          />
        </div>
      </div>

      {/* Keyframe for progress bar shrink */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
