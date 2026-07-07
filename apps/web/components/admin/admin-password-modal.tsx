"use client";

import { useState, useEffect } from "react";

export interface AdminPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export function AdminPasswordModal({
  open,
  onClose,
  onConfirm,
  title = "Verify Admin Identity",
  description = "Please confirm your administrator password to proceed with this status change.",
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal open status changes
  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const success = await onConfirm(password);
      if (success) {
        onClose();
      } else {
        setError("Incorrect administrator password.");
      }
    } catch {
      setError("A verification error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-200"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-[400px] animate-scale-in bg-white rounded-3xl overflow-hidden shadow-2xl border border-brand-sageBorder/20">
        {/* Coral Top Accent Bar */}
        <div className="h-2 bg-[#F18F76]" />

        {/* Modal Header & Content */}
        <div className="px-8 pt-7 pb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-peachBg flex items-center justify-center text-[#F18F76] mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="text-xl font-extrabold text-brand-darkTeal tracking-tight leading-tight">
            {title}
          </h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-brand-darkTeal/40">
            Authorization Required
          </p>
          <p className="mt-3 text-xs leading-relaxed text-brand-darkTeal/60">
            {description}
          </p>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          <div>
            <label
              htmlFor="admin-sudo-password"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-brand-darkTeal/55"
            >
              Administrator Password
            </label>
            <input
              id="admin-sudo-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl bg-brand-peachBg/35 border border-brand-sageBorder/40 px-4 text-brand-darkTeal placeholder-brand-darkTeal/30 outline-none transition-all duration-200 focus:border-brand-darkTeal focus:ring-1 focus:ring-brand-darkTeal/20"
              required
              autoFocus
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold leading-relaxed animate-fade-in">
              ⚠ {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-full bg-[#003E39] hover:bg-[#002f2b] text-white font-bold text-sm tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : null}
              CONFIRM AUTHORIZATION
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full h-12 rounded-full border border-brand-sageBorder/40 text-brand-darkTeal/60 hover:bg-brand-peachBg/10 font-bold text-sm tracking-wide transition-all duration-200 cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
