"use client";

import { useState } from "react";
import { hashPin, storePinHash, setPinLocked } from "@/stores/pin-store";

interface PinSetupScreenProps {
  onSetupComplete: () => void;
}

export function PinSetupScreen({ onSetupComplete }: PinSetupScreenProps) {
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNumberClick = async (num: string) => {
    if (currentPin.length >= 4 || isProcessing) return;
    
    setError(false);
    const newPin = currentPin + num;
    setCurrentPin(newPin);

    if (newPin.length === 4) {
      setIsProcessing(true);
      // Small delay for UX so user sees the 4th dot fill
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      if (phase === "enter") {
        setFirstPin(newPin);
        setCurrentPin("");
        setPhase("confirm");
        setIsProcessing(false);
      } else {
        if (newPin === firstPin) {
          // Success: Store hash
          const hash = await hashPin(newPin);
          storePinHash(hash);
          setPinLocked(false);
          onSetupComplete();
        } else {
          // Mismatch
          setError(true);
          setCurrentPin("");
          setFirstPin("");
          setPhase("enter");
          setIsProcessing(false);
        }
      }
    }
  };

  const handleDelete = () => {
    if (currentPin.length > 0 && !isProcessing) {
      setCurrentPin(currentPin.slice(0, -1));
      setError(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start bg-white px-6 pt-16 pb-12">
      {/* ── Logo ── */}
      <div className="mb-8 w-full max-w-[240px]">
        <img
          src="/merchantLogos/darkTitle.png"
          alt="BANTAYOG"
          className="h-auto w-full"
        />
      </div>

      {/* ── Titles ── */}
      <h2 className="mb-2 text-center font-body text-2xl font-bold text-[#034C52]">
        Create Your PIN
      </h2>
      <p className={`mb-10 h-5 text-center font-body text-sm ${error ? 'text-red-500 font-medium' : 'text-[#034C52]/70'}`}>
        {error ? "PINs don't match. Try again." : (phase === "enter" ? "Enter a 4-digit PIN" : "Confirm your PIN")}
      </p>

      {/* ── PIN Dots ── */}
      <div className={`mb-12 flex items-center justify-center gap-6 ${error ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full transition-colors ${
              i < currentPin.length ? "bg-[#034C52]" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* ── Number Pad ── */}
      <div className="w-full max-w-[280px] mt-auto mb-10">
        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={isProcessing}
              className="flex h-16 items-center justify-center rounded-full font-body text-3xl font-medium text-[#034C52] transition-colors active:bg-gray-100 disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          {/* Empty cell for bottom-left */}
          <div />
          <button
            onClick={() => handleNumberClick("0")}
            disabled={isProcessing}
            className="flex h-16 items-center justify-center rounded-full font-body text-3xl font-medium text-[#034C52] transition-colors active:bg-gray-100 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isProcessing}
            className="flex h-16 items-center justify-center rounded-full text-[#034C52] transition-colors active:bg-gray-100 disabled:opacity-50"
            aria-label="Delete"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
      `}} />
    </div>
  );
}
