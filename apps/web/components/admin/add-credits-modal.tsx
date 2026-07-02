"use client";

import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────
   AddCreditsModal — mock 7.png
   Dark teal header: LGU available balance + token icon.
   White body: numeric amount input + range slider 500–10,000
   + helper text + Continue (coral) / Cancel buttons.
   Pre-flight: if entered amount > LGU balance → warn + disable Continue.
   On Confirm → PATCH /api/beneficiaries/:id/credits
   ───────────────────────────────────────────────────────── */

export interface AddCreditsModalProps {
  open: boolean;
  onClose: () => void;
  beneficiaryId: string;
  beneficiaryName: string;
  /** Called after a successful credit addition so the table can refresh */
  onSuccess: () => void;
}

const SLIDER_MIN = 500;
const SLIDER_MAX = 10_000;

export function AddCreditsModal({
  open,
  onClose,
  beneficiaryId,
  beneficiaryName,
  onSuccess,
}: AddCreditsModalProps) {
  const [amount, setAmount] = useState<number>(SLIDER_MIN);
  const [lguBalance, setLguBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch LGU wallet balance when modal opens */
  useEffect(() => {
    if (!open) return;
    setError(null);
    setAmount(SLIDER_MIN);
    setBalanceLoading(true);

    fetch("/api/chain/balance")
      .then((r) => r.json())
      .then((data) => {
        const bal = parseFloat(data?.formatted ?? data?.balance ?? "0");
        setLguBalance(isNaN(bal) ? 0 : bal);
      })
      .catch(() => setLguBalance(0))
      .finally(() => setBalanceLoading(false));
  }, [open]);

  const handleAmountChange = useCallback((val: number) => {
    const clamped = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, val));
    setAmount(clamped);
    setError(null);
  }, []);

  const insufficientBalance =
    lguBalance !== null && amount > lguBalance;

  const handleConfirm = async () => {
    if (insufficientBalance || !amount) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Failed to add credits. Please try again.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Credits"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-[420px] animate-scale-in">
        {/* Dark teal header */}
        <div className="rounded-t-[1.75rem] bg-brand-darkTeal px-8 pt-7 pb-6 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-3xl leading-none tracking-tight">
              {balanceLoading ? "…" : lguBalance !== null
                ? `${lguBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHPC`
                : "00.00 PHPC"}
            </p>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1.5">
              Available Balance
            </p>
          </div>
          {/* PHPC token icon */}
          <img
            src="/adminAssets/crypto.svg"
            alt="PHPC token"
            width={56}
            height={56}
            className="object-contain flex-shrink-0 mt-1"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* White body */}
        <div className="rounded-b-[1.75rem] bg-white px-8 pt-6 pb-7 space-y-5">
          {/* Beneficiary context — muted single-line caption */}
          <p className="text-[11px] text-brand-darkTeal/40 -mt-1">
            Adding credits for <span className="text-brand-darkTeal/60 font-medium">{beneficiaryName}</span>
          </p>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-semibold text-brand-darkTeal mb-2">
              Enter Amount
            </label>
            <input
              type="number"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={50}
              value={amount}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              placeholder="00.00"
              className="w-full border-2 border-brand-sageBorder rounded-xl px-4 py-3 text-brand-darkTeal font-semibold text-lg outline-none focus:border-brand-activeTeal transition-colors"
            />
          </div>

          {/* Range slider */}
          <div>
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={50}
              value={amount}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              className="w-full h-2 cursor-pointer"
              style={{
                ['--range-pct' as string]: `${((amount - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`,
              }}
            />
            <div className="flex justify-between text-xs text-brand-darkTeal/50 font-semibold mt-1">
              <span>{SLIDER_MIN.toLocaleString()}</span>
              <span>{SLIDER_MAX.toLocaleString()}</span>
            </div>
          </div>

          {/* Helper text */}
          <p className="text-xs text-center text-brand-darkTeal/40 -mt-1">
            Enter Amount or move the slider to set the amount
          </p>

          {/* Insufficient balance warning */}
          {insufficientBalance && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
              ⚠ Entered amount exceeds LGU wallet balance. Please reduce the amount.
            </div>
          )}

          {/* API error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleConfirm}
            disabled={insufficientBalance || submitting || balanceLoading || !amount}
            className="w-full rounded-full bg-button-coral hover:bg-button-coral/90 text-white font-bold text-sm py-3.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : null}
            Continue
          </button>

          {/* Cancel button */}
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full rounded-full bg-button-cancel-bg hover:bg-button-cancel-bg/80 text-button-coral font-bold text-sm py-3.5 transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
