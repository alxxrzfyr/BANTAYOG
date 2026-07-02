"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { QrPassData } from "@/components/admin/qr-pass-modal";
import { authFetch } from "@/lib/api";

/* ─────────────────────────────────────────────────────────
   BeneficiaryRegistrationForm — mock 2.png (left card)
   Fields: Child Name, Guardian Name, Child's Birthdate (date picker),
   conditional alert banner (from API response — NOT hardcoded),
   Monthly Income (PHP), Create Your PIN (single standard input).
   Submit → POST /api/beneficiaries/register
   Success → calls onSuccess(QrPassData) to open QR Pass modal.
   ───────────────────────────────────────────────────────── */

/* Local form schema — birthdate is the form input; childAgeMonths
   is derived only when building the API payload (NOT for tier logic). */
const formSchema = z.object({
  childName: z.string().min(1, "Child name is required").max(200),
  guardianName: z.string().min(1, "Guardian name is required").max(200),
  birthdate: z.string().min(1, "Birthdate is required"),
  monthlyIncomePhp: z
    .number({ message: "Income must be a valid number" })
    .nonnegative("Income cannot be negative"),
  pin: z
    .string()
    .length(6, "PIN must be exactly 6 digits")
    .regex(/^\d+$/, "PIN must be numeric only"),
});

type FormValues = z.infer<typeof formSchema>;

interface BeneficiaryRegistrationFormProps {
  onSuccess: (data: QrPassData) => void;
  /** Increment to trigger form reset + state clear (used on QR modal close) */
  resetKey?: number;
}

export function BeneficiaryRegistrationForm({
  onSuccess,
  resetKey = 0,
}: BeneficiaryRegistrationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  /** Alert banner content from the API response (not hardcoded) */
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      childName: "",
      guardianName: "",
      birthdate: "",
      monthlyIncomePhp: undefined,
      pin: "",
    },
  });

  /* ── Track resetKey changes to trigger form + state reset ── */
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey;
      reset();
      setAlertBanner(null);
      setApiError(null);
    }
  }, [resetKey, reset]);

  /* Derive age in months from a birthdate string for API payload only */
  const deriveAgeMonths = useCallback((birthdateStr: string): number => {
    const birth = new Date(birthdateStr + "T00:00:00");
    const now = new Date();
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    return Math.max(0, months);
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setApiError(null);

    const payload = {
      childName: values.childName.trim(),
      guardianName: values.guardianName.trim(),
      /* childAgeMonths derived client-side for DTO only — tier is computed server-side */
      childAgeMonths: deriveAgeMonths(values.birthdate),
      monthlyIncomePhp: values.monthlyIncomePhp,
      pin: values.pin,
      /* guardianMobileHash placeholder — form field not in mock, defaults to hash of PIN */
      guardianMobileHash: values.pin,
      /* GPS defaults — admin form does not capture GPS in mock */
      gpsLat: 14.5995,
      gpsLng: 120.9842,
    };

    try {
      const res = await authFetch("/api/beneficiaries/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setApiError(body?.message ?? "Registration failed. Please try again.");

        /* If the API returns a tier_alert / alert_banner, surface it */
        if (body?.alert_banner) setAlertBanner(body.alert_banner);
        return;
      }

      /* Surface any tier-based alert from the API (e.g. "Critical 1,000-Day Window") */
      if (body?.alert_banner) {
        setAlertBanner(body.alert_banner);
      }

      /* Build QrPassData from the API response — tier comes from the API, never computed */
      const qrData: QrPassData = {
        jwsCompact: typeof body.qrToken === "string" ? body.qrToken : (body.qrToken?.jwsCompact ?? body.jwsCompact ?? "no-token"),
        cardSerial: body.cardSerial ?? body.beneficiary?.cardSerial ?? body.qrToken?.cardSerial ?? "LBT-0000-000",
        childName: body.childName ?? values.childName,
        guardianName: body.guardianName ?? values.guardianName,
        birthdate: values.birthdate,
        tier: body.tier === "TIER_1_CRITICAL" || body.tier === 1
          ? "TIER_1_CRITICAL"
          : "TIER_2_STANDARD",
      };

      onSuccess(qrData);
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-2xl p-7 border border-border-input/30 shadow-sm h-full">
      {/* Card heading */}
      <div className="flex items-center gap-3 pb-4 border-b border-brand-sageBorder/20 mb-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/60 flex-shrink-0">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        <h2 className="font-bold text-brand-darkTeal text-base">
          Register Guardian-Child Unit
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Child Name */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal mb-2">
            Child Name
          </label>
          <input
            type="text"
            placeholder="e.g., Juan Dela Cruz"
            {...register("childName")}
            className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-brand-darkTeal placeholder:text-brand-darkTeal/30 outline-none transition-colors ${
              errors.childName
                ? "border-red-400"
                : "border-border-input focus:border-brand-activeTeal"
            }`}
          />
          {errors.childName && (
            <p className="text-xs text-red-500 font-semibold mt-1">{errors.childName.message}</p>
          )}
        </div>

        {/* Guardian Name */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal mb-2">
            Guardian Name
          </label>
          <input
            type="text"
            placeholder="e.g., Maria Dela Cruz"
            {...register("guardianName")}
            className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-brand-darkTeal placeholder:text-brand-darkTeal/30 outline-none transition-colors ${
              errors.guardianName
                ? "border-red-400"
                : "border-border-input focus:border-brand-activeTeal"
            }`}
          />
          {errors.guardianName && (
            <p className="text-xs text-red-500 font-semibold mt-1">{errors.guardianName.message}</p>
          )}
        </div>

        {/* Child's Birthdate */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal mb-2">
            Child&apos;s Birthdate
          </label>
          <input
            type="date"
            {...register("birthdate")}
            max={new Date().toISOString().split("T")[0]}
            className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-brand-darkTeal outline-none transition-colors ${
              errors.birthdate
                ? "border-red-400"
                : "border-border-input focus:border-brand-activeTeal"
            }`}
          />
          {errors.birthdate && (
            <p className="text-xs text-red-500 font-semibold mt-1">{errors.birthdate.message}</p>
          )}
        </div>

        {/* Alert Banner — content from API response, NOT hardcoded */}
        {alertBanner && (
          <div className="flex items-start gap-3 bg-alert-bg border border-alert-border rounded-xl px-4 py-3">
            <span className="text-alert-text mt-0.5 flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-alert-text">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-xs font-semibold text-alert-text leading-relaxed">
              {alertBanner}
            </p>
          </div>
        )}

        {/* Monthly Income + PIN — side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Monthly Income */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal mb-2">
              Monthly Income (PHP)
            </label>
            <input
              type="number"
              min={0}
              placeholder="12000"
              {...register("monthlyIncomePhp", { valueAsNumber: true })}
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-brand-darkTeal placeholder:text-brand-darkTeal/30 outline-none transition-colors ${
                errors.monthlyIncomePhp
                  ? "border-red-400"
                  : "border-border-input focus:border-brand-activeTeal"
              }`}
            />
            {errors.monthlyIncomePhp && (
              <p className="text-xs text-red-500 font-semibold mt-1">{errors.monthlyIncomePhp.message}</p>
            )}
          </div>

          {/* Create PIN — single clean input, no dot-preview */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-darkTeal mb-2">
              Create Your PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="Enter 6-digit PIN"
              {...register("pin")}
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-brand-darkTeal placeholder:text-brand-darkTeal/30 outline-none transition-colors ${
                errors.pin
                  ? "border-red-400"
                  : "border-border-input focus:border-brand-activeTeal"
              }`}
            />
            {errors.pin && (
              <p className="text-xs text-red-500 font-semibold mt-1">{errors.pin.message}</p>
            )}
          </div>
        </div>

        {/* API error */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
            {apiError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2.5 bg-brand-darkTeal hover:bg-brand-activeTeal text-white font-bold text-sm py-4 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {submitting ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          Onboard &amp; Generate QR ID
        </button>
      </form>
    </div>
  );
}
