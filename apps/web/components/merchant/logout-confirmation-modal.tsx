"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearMerchantToken } from "@/lib/api";
import { useCartStore } from "@/stores/cart-store";
import { useQueryClient } from "@tanstack/react-query";

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoutConfirmationModal({ isOpen, onClose }: LogoutConfirmationModalProps) {
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    // Clear everything
    clearMerchantToken(); // This now also clears the PIN hash
    clearCart();
    queryClient.clear();
    
    // Redirect to login
    router.push("/merchant-login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-center font-body text-xl font-bold text-[#034C52]">
          Log Out?
        </h3>
        <p className="mb-6 text-center font-body text-sm text-[#034C52]/70">
          Are you sure you want to log out? You'll need to sign in again.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-full bg-red-500 py-3 font-body text-sm font-bold text-white transition-colors hover:bg-red-600 active:bg-red-700 disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Log Out"}
          </button>
          
          <button
            onClick={onClose}
            disabled={isLoggingOut}
            className="w-full rounded-full border border-gray-200 bg-white py-3 font-body text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
