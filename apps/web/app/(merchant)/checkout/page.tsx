"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { CartSummary } from "@/components/merchant/cart-summary";
import { ItemCard } from "@/components/merchant/item-card";

// ---------------------------------------------------------------------------
// Checkout Page + QR Scanner Modal + PIN Validation Modal (ref: 25-27.png)
// ---------------------------------------------------------------------------

type ModalState = "none" | "qr-scan" | "pin";

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const inputSource = useCartStore((s) => s.inputSource);

  const [modalState, setModalState] = useState<ModalState>("none");
  const [beneficiaryData, setBeneficiaryData] = useState<{
    id: string;
    name: string;
    guardianName: string;
    balance: number;
  } | null>(null);
  const [pinError, setPinError] = useState(false);

  // Filter to eligible items only
  const eligibleItems = items.filter((i) => i.eligibility === "eligible");
  const total = eligibleItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Back navigation based on input source
  const backHref =
    inputSource === "ai" ? "/cart/ai-scan?resume=result" : "/cart/manual";

  // ── QR Scan Simulation ──
  const handleSimulateScan = useCallback(() => {
    // Simulate a successful QR scan with mock beneficiary data
    setBeneficiaryData({
      id: "BEN-001",
      name: "Maria Dela Cruz",
      guardianName: "Juan Dela Cruz",
      balance: 740,
    });
    setModalState("pin");
  }, []);

  // ── PIN Verification ──
  const handlePinComplete = useCallback(
    (pin: string) => {
      setPinError(false);

      // Mock verification: accept '123456' as correct
      if (pin === "123456" && beneficiaryData) {
        // Navigate to complete page with transaction data
        const params = new URLSearchParams({
          amount: total.toFixed(2),
          beneficiary: beneficiaryData.guardianName,
          remaining: (beneficiaryData.balance - total).toFixed(0),
        });
        router.push(`/checkout/complete?${params.toString()}`);
      } else {
        setPinError(true);
      }
    },
    [beneficiaryData, total, router],
  );

  // ── Empty Cart ──
  if (eligibleItems.length === 0) {
    return (
      <div className="min-h-dvh bg-[#fdf2ed]">
        <header className="flex items-center px-4 pt-5 pb-3">
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            aria-label="Back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#034C52"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center font-title text-[1.35rem] font-black text-[#034C52]">
            Checkout
          </h1>
          <div className="w-9" />
        </header>
        <div className="h-px bg-gray-400" />
        <div className="flex flex-col items-center justify-center px-5 py-16">
          <p className="font-body text-sm text-gray-500">
            No eligible items in your cart.
          </p>
          <Link
            href="/cart"
            className="mt-4 rounded-full bg-[#034C52] px-6 py-2.5 font-body text-sm font-bold text-white"
          >
            Add Items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#fdf2ed]">
      {/* ── Header ── */}
      <header className="flex items-center px-4 pt-5 pb-3">
        <Link
          href={backHref}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          aria-label="Back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#034C52"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center font-title text-[1.35rem] font-black text-[#034C52]">
          Checkout
        </h1>
        <div className="w-9" />
      </header>

      <div className="h-px bg-gray-400" />

      {/* ── Content ── */}
      <div className="px-5 pb-8">
        {/* Store Info */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#034C52]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/profile.png"
              alt=""
              className="h-8 w-8 rounded-full"
            />
          </div>
          <div>
            <p className="font-body text-base font-bold text-gray-900">
              Store Name
            </p>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-[#a8d5ba] bg-[#f0faf3] px-2 py-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/merchantLogos/verifiedBadge.png"
                alt=""
                className="h-3 w-3"
              />
              <span className="font-body text-[10px] font-semibold text-[#034C52]">
                LGU Verified Store
              </span>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <h3 className="mb-3 font-body text-base font-bold text-[#034C52]">
            Cart Items ({eligibleItems.length})
          </h3>
          <div className="space-y-3">
            {eligibleItems.map((item) => (
              <ItemCard
                key={item.id}
                name={item.name}
                price={item.price}
                quantity={item.quantity}
                eligibility={item.eligibility}
                imageDataUrl={item.imageDataUrl}
              />
            ))}
          </div>
        </div>

        {/* Cart Summary */}
        <div className="mt-5">
          <CartSummary />
        </div>

        {/* Payment Method */}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <h3 className="mb-3 font-body text-base font-bold text-[#034C52]">
            Payment Method
          </h3>
          <button
            type="button"
            onClick={() => setModalState("qr-scan")}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/qrSample.png"
              alt=""
              className="h-8 w-8 flex-shrink-0"
            />
            <span className="flex-1 text-left font-body text-sm font-medium text-gray-700">
              Bantayog Credit
            </span>
            <span className="font-body text-sm font-semibold text-gray-600">
              {total.toFixed(2)} PHPC
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9e8e82"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Checkout Button */}
        <button
          type="button"
          onClick={() => setModalState("qr-scan")}
          className="mt-6 w-full rounded-2xl bg-[#034C52] py-4 font-body text-base font-bold text-white transition-colors hover:bg-[#017075] active:brightness-95"
        >
          Confirm & Checkout
        </button>
      </div>

      {/* ── QR Scanner Modal (FE2-3.6) ── */}
      {modalState === "qr-scan" && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="QR Scanner"
        >
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Content */}
          <div className="relative flex flex-1 flex-col">
            {/* Header */}
            <div className="flex items-center px-4 pt-5 pb-3">
              <button
                type="button"
                onClick={() => setModalState("none")}
                className="flex h-9 w-9 items-center justify-center"
                aria-label="Close QR scanner"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                <span className="inline-block rounded-full bg-[#f48d79] px-6 py-2 font-title text-sm font-black text-[#034C52]">
                  QR Scanner
                </span>
              </div>
              <div className="w-9" />
            </div>

            {/* Scanner Area */}
            <div className="flex flex-1 flex-col items-center justify-center px-8">
              {/* QR Scanner Frame */}
              <div className="relative w-full max-w-sm aspect-square">
                {/* Black background */}
                <div className="absolute inset-0 rounded-3xl bg-black" />

                {/* Scanner frame border */}
                <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-[#f48d79]" />

                {/* Corner brackets */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-4 top-4 h-12 w-12 border-l-[4px] border-t-[4px] border-[#f48d79] rounded-tl-lg" />
                  <div className="absolute right-4 top-4 h-12 w-12 border-r-[4px] border-t-[4px] border-[#f48d79] rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 h-12 w-12 border-b-[4px] border-l-[4px] border-[#f48d79] rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 h-12 w-12 border-b-[4px] border-r-[4px] border-[#f48d79] rounded-br-lg" />
                </div>

                {/* Simulate button */}
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
                    <span className="font-body text-sm font-bold text-white">
                      Tap to Simulate Scan
                    </span>
                  </div>
                </button>
              </div>

              {/* Instruction */}
              <p className="mt-5 text-center font-body text-sm font-semibold text-white">
                Align Beneficiary QR Card inside the frame
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN Validation Modal (FE2-3.7) ── */}
      {modalState === "pin" && (
        <PINModal
          guardianName={beneficiaryData?.guardianName || "Beneficiary"}
          error={pinError}
          onBack={() => {
            setModalState("qr-scan");
            setPinError(false);
          }}
          onComplete={handlePinComplete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PIN Validation Modal Component
// ---------------------------------------------------------------------------

function PINModal({
  guardianName,
  error,
  onBack,
  onComplete,
}: {
  guardianName: string;
  error: boolean;
  onBack: () => void;
  onComplete: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  const maxDigits = 6;

  const handleDigit = (digit: string) => {
    if (pin.length < maxDigits) {
      const newPin = pin + digit;
      setPin(newPin);

      // Auto-submit on 6th digit
      if (newPin.length === maxDigits) {
        setTimeout(() => onComplete(newPin), 300);
      }
    }
  };

  const handleClear = () => {
    setPin("");
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#034C52]"
      role="dialog"
      aria-modal="true"
      aria-label="PIN Validation"
    >
      {/* Header */}
      <header className="flex items-center px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center"
          aria-label="Back to QR scanner"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <span className="inline-block rounded-full bg-[#f48d79] px-6 py-2 font-title text-sm font-black text-[#034C52]">
            Pin Validation
          </span>
        </div>
        <div className="w-9" />
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center px-6 pt-6">
        {/* Lock Icon */}
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#f48d79]/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/merchantLogos/lock2.png"
            alt=""
            className="h-8 w-8"
          />
        </div>

        {/* Title */}
        <h2 className="text-center font-body text-lg font-bold text-white">
          Enter Beneficiary Guardian Security PIN
        </h2>
        <p className="mt-2 text-center font-body text-sm text-white/70">
          Authorizing voucher transaction for
        </p>
        <p className="mt-1 text-center font-body text-sm font-bold text-[#f48d79]">
          {guardianName}
        </p>

        {/* PIN Progress Circles */}
        <div className="mt-6 flex items-center gap-3">
          {Array.from({ length: maxDigits }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                i < pin.length
                  ? "border-white bg-white"
                  : "border-white/40 bg-transparent"
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="mt-4 font-body text-sm font-semibold text-red-400">
            Incorrect PIN. Please try again.
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="flex h-14 items-center justify-center rounded-xl bg-[#017075] font-body text-xl font-bold text-white transition-colors hover:bg-[#015f63] active:brightness-90"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-14 items-center justify-center rounded-xl font-body text-sm font-bold text-[#f48d79] transition-colors hover:bg-white/5"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="flex h-14 items-center justify-center rounded-xl bg-[#017075] font-body text-xl font-bold text-white transition-colors hover:bg-[#015f63] active:brightness-90"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-14 items-center justify-center rounded-xl font-body text-sm font-bold text-white transition-colors hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
