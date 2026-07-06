"use client";

import { useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";

/* ─────────────────────────────────────────────────────────
   QRPassModal — mocks 3.png (Tier 1) / 4.png (Tier 2) / 8.png / 9.png
   "Generated Beneficiary QR Pass" heading.
   Dark teal card with:
   – PH flag + "REPUBLIC OF THE PHILIPPINES / BANTAYOG NUTRITION PASS" left
   – Tier pill top-right (driven entirely by API tier field — NEVER computed)
   – QR code (encodes jwsCompact JWT) + card serial below
   – Child name, guardian, age/birthdate on the right
   – Footer: LGU office name from auth session
   Two buttons: Print Voucher App | Save to Device (PNG download).
   ───────────────────────────────────────────────────────── */

export interface QrPassData {
  /** Signed JWT to encode in the QR code */
  jwsCompact: string;
  /** e.g. "LBT-2026-001" */
  cardSerial: string;
  childName: string;
  guardianName: string;
  /** ISO date string e.g. "2025-08-01" */
  birthdate: string;
  /** "TIER_1_CRITICAL" | "TIER_2_STANDARD" — from API, never computed client-side */
  tier: "TIER_1_CRITICAL" | "TIER_2_STANDARD";
}

export interface QrPassModalProps {
  open: boolean;
  onClose: () => void;
  data: QrPassData | null;
}

function TierPill({ tier }: { tier: QrPassData["tier"] }) {
  const isCritical = tier === "TIER_1_CRITICAL";
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-[9px] font-extrabold
        uppercase tracking-wider border
        ${isCritical
          ? "bg-brand-coral text-white border-brand-coral"
          : "bg-brand-coral/10 text-brand-coral border-brand-coral/40"
        }
      `}
    >
      {isCritical ? "TIER 1 CRITICAL" : "TIER 2 STANDARD"}
    </span>
  );
}

export function QrPassModal({ open, onClose, data }: QrPassModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  /* ── Print: scoped @media print shows only .qr-pass-card ── */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ── Save to Device: html-to-image → PNG download ── */
  const handleSave = useCallback(async () => {
    if (!cardRef.current || !data) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `bantayog-qr-${data.cardSerial}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      console.error("Failed to export QR pass image");
    }
  }, [data]);

  if (!open || !data) return null;

  /* LGU office name — static label matching the mock footer */
  const lguOfficeName =
    "Metro Manila City - District 2 (Municipal Nutrition Office)";

  return (
    <>
      {/* ── @media print: show only the pass card ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .qr-pass-print-wrapper { display: flex !important; }
        }
      `}</style>

      {/* Hidden print-only wrapper */}
      <div
        className="qr-pass-print-wrapper hidden fixed inset-0 z-[9999] bg-white items-center justify-center"
        aria-hidden="true"
      >
        <QrPassCard data={data} cardRef={null} lguOfficeName={lguOfficeName} />
      </div>

      {/* Modal overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Generated Beneficiary QR Pass"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal card */}
        <div className="relative w-full max-w-[520px] bg-white/95 rounded-[2rem] shadow-2xl p-6 animate-scale-in">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white border border-brand-sageBorder/40 flex items-center justify-center text-brand-darkTeal/60 hover:text-brand-darkTeal hover:bg-brand-peachBg transition-all cursor-pointer shadow-sm z-10"
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Heading */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-black text-brand-darkTeal tracking-tight">
              Generated Beneficiary QR Pass
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-darkTeal/40 mt-1">
              Ready for PWA Wallet Save or Paper Printing
            </p>
          </div>

          {/* The pass card (also used for export) */}
          <QrPassCard data={data} cardRef={cardRef} lguOfficeName={lguOfficeName} />

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            {/* Print Voucher App */}
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-darkTeal hover:bg-brand-activeTeal text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-full transition-all duration-200 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Voucher App
            </button>

            {/* Save to Device */}
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-coral hover:bg-brand-coralHover text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-full transition-all duration-200 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Save to Device
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-component: the physical QR pass card ─── */
function QrPassCard({
  data,
  cardRef,
  lguOfficeName,
}: {
  data: QrPassData;
  cardRef: React.RefObject<HTMLDivElement | null> | null;
  lguOfficeName: string;
}) {
  const birthdateDisplay = data.birthdate
    ? new Date(data.birthdate + "T00:00:00").toLocaleDateString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    : "0000-00-00";

  return (
    <div
      ref={cardRef}
      className="bg-brand-darkTeal rounded-2xl overflow-hidden"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Card header row */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {/* PH flag circle */}
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30">
            {/* Simplified PH flag representation */}
            <div className="w-full h-full bg-gradient-to-b from-[#0038A8] via-[#CE1126] to-[#FCD116]" />
          </div>
          <div>
            <p className="text-brand-coral text-[9px] font-extrabold uppercase tracking-[0.12em] leading-tight">
              Republic of the Philippines
            </p>
            <p className="text-white/60 text-[8px] font-semibold uppercase tracking-wider leading-tight">
              Bantayog Nutrition Pass
            </p>
          </div>
        </div>
        {/* Tier pill — driven entirely by API tier field */}
        <TierPill tier={data.tier} />
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/15" />

      {/* Card body: QR left, info right */}
      <div className="px-5 py-4 flex gap-5 items-center">
        {/* QR code block */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className="bg-white p-2.5 rounded-xl">
            <QRCode
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/balance?token=${encodeURIComponent(data.jwsCompact)}`
                  : `/balance?token=${encodeURIComponent(data.jwsCompact)}`
              }
              size={120}
              fgColor="#034c52"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-white/50 text-[9px] font-mono font-semibold tracking-wider">
            {data.cardSerial}
          </p>
        </div>

        {/* Info block */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-white/40 text-[8px] font-semibold uppercase tracking-widest">
              Child Beneficiary
            </p>
            <p className="text-white font-bold text-base leading-tight mt-0.5">
              {data.childName}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-[8px] font-semibold uppercase tracking-widest">
              Guardian
            </p>
            <p className="text-white font-bold text-sm leading-tight mt-0.5">
              {data.guardianName}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-[8px] font-semibold uppercase tracking-widest">
              Age (Birthdate)
            </p>
            <p className="text-white font-bold text-sm leading-tight mt-0.5">
              {birthdateDisplay}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: LGU office name */}
      <div className="mx-5 mb-4 pt-2 border-t border-white/15">
        <p className="text-white/35 text-[8px] font-semibold tracking-wider text-right">
          {lguOfficeName}
        </p>
      </div>
    </div>
  );
}
