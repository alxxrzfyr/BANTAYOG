"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ───────────────────────────────────────────
   Auth Context — Lightweight portal & auth state
   ─────────────────────────────────────────── */

export type PortalType = "lgu" | "merchant";
export type AuthStatus = "idle" | "connecting" | "authenticated" | "loading-merchant";

interface AuthState {
  portal: PortalType;
  status: AuthStatus;
  walletConnected: boolean;
  username: string;
}

interface AuthContextValue {
  state: AuthState;
  setPortal: (portal: PortalType) => void;
  setWalletConnected: (connected: boolean) => void;
  setUsername: (name: string) => void;
  authenticate: () => void;
  logout: () => void;
  clearMerchantLoading: () => void;
}

const initialState: AuthState = {
  portal: "lgu",
  status: "idle",
  walletConnected: false,
  username: "",
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const setPortal = useCallback((portal: PortalType) => {
    setState((prev) => ({ ...prev, portal, status: "idle" }));
  }, []);

  const setWalletConnected = useCallback((connected: boolean) => {
    setState((prev) => ({ ...prev, walletConnected: connected }));
  }, []);

  const setUsername = useCallback((name: string) => {
    setState((prev) => ({ ...prev, username: name }));
  }, []);

  const authenticate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: prev.portal === "merchant" ? "loading-merchant" : "authenticated",
    }));
  }, []);

  const logout = useCallback(() => {
    setState(initialState);
  }, []);

  const clearMerchantLoading = useCallback(() => {
    setState((prev) => ({ ...prev, status: "idle" }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        state,
        setPortal,
        setWalletConnected,
        setUsername,
        authenticate,
        logout,
        clearMerchantLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
