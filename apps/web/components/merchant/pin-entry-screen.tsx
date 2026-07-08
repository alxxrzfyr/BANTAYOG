"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hashPin, getPinHash, setPinLocked } from "@/stores/pin-store";
import { clearMerchantToken } from "@/lib/api";
import { useCartStore } from "@/stores/cart-store";
import { useQueryClient } from "@tanstack/react-query";

interface PinEntryScreenProps {
  onUnlock: () => void;
}

export function PinEntryScreen({ onUnlock }: PinEntryScreenProps) {
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const queryClient = useQueryClient();
  
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const handleForgotPin = () => {
    // Clear everything and force full re-login
    clearMerchantToken(); // Also clears PIN hash
    clearCart();
    queryClient.clear();
    router.push("/merchant-login");
  };

  const handleNumberClick = async (num: string) => {
    if (currentPin.length >= 4 || isProcessing || isLockedOut) return;
    
    setError(false);
    const newPin = currentPin + num;
    setCurrentPin(newPin);

    if (newPin.length === 4) {
      setIsProcessing(true);
      
      // Small delay for UX so user sees the 4th dot fill
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const hashedAttempt = await hashPin(newPin);
      const storedHash = getPinHash();
      
      if (hashedAttempt === storedHash) {
        // Success
        setPinLocked(false);
        setAttempts(0);
        onUnlock();
      } else {
        // Failed
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(true);
        setCurrentPin("");
        
        if (newAttempts >= 3) {
          setIsLockedOut(true);
          // Lock for 3 seconds then allow retry, but show "Forgot PIN" link
          setTimeout(() => {
            setIsLockedOut(false);
          }, 3000);
        }
        setIsProcessing(false);
      }
    }
  };

  const handleDelete = () => {
    if (currentPin.length > 0 && !isProcessing && !isLockedOut) {
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
        Enter Your PIN
      </h2>
      <div className="h-5 flex items-center justify-center mb-10">
        {error ? (
          <p className="font-body text-sm font-medium text-red-500">
            Incorrect PIN. {3 - attempts > 0 ? `${3 - attempts} attempts left.` : ""}
          </p>
        ) : (
          <p className="font-body text-sm text-[#034C52]/70">
            Enter your 4-digit PIN to unlock
          </p>
        )}
      </div>

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
      <div className="w-full max-w-[280px] mt-auto mb-6">
        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={isProcessing || isLockedOut}
              className="flex h-16 items-center justify-center rounded-full font-body text-3xl font-medium text-[#034C52] transition-colors active:bg-gray-100 disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          {/* Empty cell for bottom-left */}
          <div />
          <button
            onClick={() => handleNumberClick("0")}
            disabled={isProcessing || isLockedOut}
            className="flex h-16 items-center justify-center rounded-full font-body text-3xl font-medium text-[#034C52] transition-colors active:bg-gray-100 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isProcessing || isLockedOut}
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

      {/* ── Forgot PIN ── */}
      <div className="h-10 flex items-center justify-center">
        {attempts >= 3 && (
          <button 
            onClick={handleForgotPin}
            className="font-body text-sm font-semibold text-[#f48d79] transition-colors hover:text-[#f9a899]"
          >
            Forgot PIN?
          </button>
        )}
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
