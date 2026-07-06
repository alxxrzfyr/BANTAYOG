"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/api";

/* ─────────────────────────────────────────────────────────
   AddCreditsModal — one-time tier-based PHPC allocation.

   Allocation amounts are FIXED by the beneficiary's tier and are
   NOT caller-chosen:
     • Tier 1 (Critical 1,000-Day Window) → 5,000 PHPC
     • Tier 2 (Standard)                  → 3,500 PHPC
   The backend (PATCH /api/beneficiaries/:id/credits) derives the amount
   from the beneficiary's tier and ignores any client-supplied value, so
   this modal shows the fixed amount as a read-only confirmation rather
   than an editable slider.

   Dark teal header: LGU available balance + token icon.
   White body: read-only tier + fixed allocation amount + Confirm/Cancel.
   Pre-flight: if allocation amount > LGU balance → warn + disable Confirm.
   ───────────────────────────────────────────────────────── */

export type BeneficiaryTier = "TIER_1_CRITICAL" | "TIER_2_STANDARD";

export interface AddCreditsModalProps {
  open: boolean;
  onClose: () => void;
  beneficiaryId: string;
  beneficiaryName: string;
  /** Beneficiary's intervention tier — determines the fixed allocation amount. */
  tier: BeneficiaryTier;
  /** Called after a successful credit addition so the table can refresh */
  onSuccess: () => void;
  lguBalance: number | null;
}

/** Fixed one-time allocation amounts, in whole PHPC (Requirements 4.1, 4.2). */
const TIER_1_ALLOCATION = 5_000;
const TIER_2_ALLOCATION = 3_500;

export function AddCreditsModal({
  open,
  onClose,
  beneficiaryId,
  beneficiaryName,
  tier,
  onSuccess,
  lguBalance,
}: AddCreditsModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCritical = tier === "TIER_1_CRITICAL";
  const allocationAmount = isCritical ? TIER_1_ALLOCATION : TIER_2_ALLOCATION;
  const tierLabel = isCritical ? "Tier 1 · Critical 1,000-Day Window" : "Tier 2 · Standard";

  /* Reset error when modal opens */
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const insufficientBalance =
    lguBalance !== null && lguBalance > 0 && allocationAmount > lguBalance;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);

    try {
      /* Body is ignored server-side — the amount is derived from the tier. */
      const res = await authFetch(`/api/beneficiaries/${beneficiaryId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Failed to allocate credits. Please try again.");
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
      aria-label="Allocate Credits"
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
              {lguBalance !== null
                ? `${lguBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHPC`
                : "00.00 PHPC"}
            </p>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1.5">
              LGU Available Balance
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
            Allocating credits for <span className="text-brand-darkTeal/60 font-medium">{beneficiaryName}</span>
          </p>

          {/* Fixed tier allocation — read-only confirmation */}
          <div className="rounded-2xl border-2 border-brand-sageBorder bg-brand-peachBg/30 px-5 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal/40">
              One-Time Allocation
            </p>
            <p className="mt-2 text-4xl font-black text-brand-darkTeal leading-none">
              {allocationAmount.toLocaleString("en-PH")}
              <span className="text-lg font-bold text-brand-darkTeal/50"> PHPC</span>
            </p>
            <span
              className={`
                mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border select-none
                ${isCritical
                  ? "bg-brand-coral/10 border-brand-coral/40 text-brand-coral"
                  : "bg-green-50 border-green-300 text-green-700"
                }
              `}
            >
              {tierLabel}
            </span>
          </div>

          {/* Helper text */}
          <p className="text-xs text-center text-brand-darkTeal/40 -mt-1">
            The allocation amount is fixed by the beneficiary&apos;s tier and cannot be changed.
          </p>

          {/* Insufficient balance warning */}
          {insufficientBalance && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
              ⚠ Allocation amount exceeds the LGU wallet balance. Please fund the treasury first.
            </div>
          )}

          {/* API error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={submitting || insufficientBalance}
            className="w-full rounded-full bg-button-coral hover:bg-button-coral/90 text-white font-bold text-sm py-3.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : null}
            Confirm Allocation
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
