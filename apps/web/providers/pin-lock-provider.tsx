"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasPin, isPinLocked, setPinLocked } from "@/stores/pin-store";
import { MERCHANT_TOKEN_KEY } from "@/lib/api";
import { PinSetupScreen } from "@/components/merchant/pin-setup-screen";
import { PinEntryScreen } from "@/components/merchant/pin-entry-screen";

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/merchant-login";
  
  const [isClient, setIsClient] = useState(false);
  const [locked, setLocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Check initial state on mount and set up visibility listener
  useEffect(() => {
    setIsClient(true);
    
    const checkState = () => {
      if (isLoginPage) return;
      
      const hasToken = !!window.localStorage.getItem(MERCHANT_TOKEN_KEY);
      if (!hasToken) return;

      if (!hasPin()) {
        setNeedsSetup(true);
        setLocked(false);
      } else {
        setNeedsSetup(false);
        if (isPinLocked()) {
          setLocked(true);
        } else {
          // On fresh load, we lock it just to be safe if they have a pin
          // Unless they literally just set it
          setLocked(true);
          setPinLocked(true);
        }
      }
    };

    checkState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const hasToken = !!window.localStorage.getItem(MERCHANT_TOKEN_KEY);
        if (hasToken && hasPin() && !isLoginPage) {
          setPinLocked(true);
          setLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also lock on window blur (when user switches tabs or apps)
    const handleBlur = () => {
      const hasToken = !!window.localStorage.getItem(MERCHANT_TOKEN_KEY);
      if (hasToken && hasPin() && !isLoginPage) {
        setPinLocked(true);
        setLocked(true);
      }
    };
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isLoginPage]);

  // We don't block render on server, but we shouldn't show pin overlay either
  if (!isClient) {
    return <>{children}</>;
  }

  // If on login page, don't show any PIN screens
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      {needsSetup && (
        <PinSetupScreen 
          onSetupComplete={() => {
            setNeedsSetup(false);
            setLocked(false);
          }} 
        />
      )}
      
      {!needsSetup && locked && (
        <PinEntryScreen 
          onUnlock={() => {
            setLocked(false);
          }} 
        />
      )}
      
      {/* We always render children so the state is maintained underneath the overlay */}
      {children}
    </>
  );
}
