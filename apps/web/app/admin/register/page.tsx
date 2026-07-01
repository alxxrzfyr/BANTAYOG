"use client";

import { useState, useCallback } from "react";
import { StatusBar } from "@/components/admin/status-bar";
import { BeneficiaryRegistrationForm } from "@/components/admin/beneficiary-registration-form";
import { MerchantRegistrationForm } from "@/components/admin/merchant-registration-form";
import { QrPassModal, type QrPassData } from "@/components/admin/qr-pass-modal";
import { MerchantVerifiedToast } from "@/components/admin/merchant-verified-toast";

/* ─────────────────────────────────────────────────────────
   Registration Page — mock 2.png
   Both forms rendered SIDE-BY-SIDE simultaneously (NOT a tab switcher).
   Left card → BeneficiaryRegistrationForm → opens QrPassModal on success.
   Right card → MerchantRegistrationForm → shows MerchantVerifiedToast on success.
   ───────────────────────────────────────────────────────── */

export default function RegisterPage() {
  const [qrPassOpen, setQrPassOpen] = useState(false);
  const [qrPassData, setQrPassData] = useState<QrPassData | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  /** Incremented to trigger beneficiary form reset on QR modal close */
  const [beneficiaryResetKey, setBeneficiaryResetKey] = useState(0);

  const handleBeneficiarySuccess = useCallback((data: QrPassData) => {
    setQrPassData(data);
    setQrPassOpen(true);
  }, []);

  const handleMerchantSuccess = useCallback(() => {
    setToastOpen(true);
  }, []);

  const handleQrModalClose = useCallback(() => {
    setQrPassOpen(false);
    setBeneficiaryResetKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Status bar — shared across admin pages */}
      <StatusBar />

      {/* Two registration forms side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BeneficiaryRegistrationForm onSuccess={handleBeneficiarySuccess} resetKey={beneficiaryResetKey} />
        <MerchantRegistrationForm onSuccess={handleMerchantSuccess} />
      </div>

      {/* QR Pass modal — opens after beneficiary registration */}
      <QrPassModal
        open={qrPassOpen}
        onClose={handleQrModalClose}
        data={qrPassData}
      />

      {/* Merchant verified toast — auto-dismisses after 4s */}
      <MerchantVerifiedToast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
