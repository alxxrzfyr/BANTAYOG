"use client";

import { useState, useCallback } from "react";
import { TransferModal } from "./transfer-modal";
import {
  pickWallet,
  verifyWalletConnection,
  verifyWalletWithBackend,
} from "@/lib/chain/wallet-adapter";

// ---------------------------------------------------------------------------
// Wallet Balance Card — matches the dark teal card in merchantPages/13.png
// ---------------------------------------------------------------------------

interface WalletBalanceCardProps {
  /** PHPC balance (displayed as-is, e.g. "0.00") */
  balance: string;
  /** PHP equivalent (1:1 peg, displayed as "P0.00") */
  phpEquivalent: string;
  /** Merchant's EVM wallet address (truncated display) */
  walletAddress: string;
  /** Called after a successful transfer so parent can refresh data */
  onTransferSuccess?: () => void;
}

type WalletStatus = "idle" | "connecting" | "connected" | "error";

export function WalletBalanceCard({
  balance,
  phpEquivalent,
  walletAddress,
  onTransferSuccess,
}: WalletBalanceCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // ── Wallet connection state ──
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const handleConnectWallet = useCallback(async () => {
    setWalletStatus("connecting");
    setWalletError(null);

    try {
      // 1. Run the decision tree to get a wallet connection
      const connection = await pickWallet();

      // 2. Verify ownership client-side (sign message, check signature)
      const clientResult = await verifyWalletConnection(connection);
      if (!clientResult.verified) {
        setWalletStatus("error");
        setWalletError("Wallet ownership verification failed.");
        return;
      }

      // 3. Verify with backend (BE2-3.7)
      const backendResult = await verifyWalletWithBackend(
        connection.address,
        connection.proof,
      );
      if (!backendResult.verified) {
        setWalletStatus("error");
        setWalletError(
          backendResult.error || "Backend verification failed.",
        );
        return;
      }

      // 4. Success
      setConnectedAddress(connection.address);
      setWalletStatus("connected");
    } catch (err) {
      setWalletStatus("error");
      setWalletError(
        err instanceof Error ? err.message : "Wallet connection failed.",
      );
    }
  }, []);

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  };

  return (
    <>
      <div className="rounded-2xl bg-[#034C52] px-6 py-7 text-white">
        {/* Top row: label + wallet icon */}
        <div className="mb-1 flex items-start justify-between">
          <p className="font-body text-xs font-semibold uppercase tracking-wider text-[#f48d79]">
            Digital Wallet Balance
          </p>
          <img
            src="/merchantLogos/wallet.png"
            alt="Digital wallet icon"
            className="h-10 w-10 flex-shrink-0"
          />
        </div>

        {/* Balance */}
        <p className="mb-0.5 font-body text-4xl font-extrabold tracking-tight">
          {balance} <span className="text-lg font-bold">PHPC</span>
        </p>
        <p className="mb-5 font-body text-sm font-medium text-[#f48d79]">
          = {phpEquivalent} PHP
        </p>

        {/* Divider */}
        <div className="mb-4 h-px bg-white/20" />

        {/* Wallet Connection Row */}
        {walletStatus === "connected" && connectedAddress ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="truncate font-body text-xs font-medium text-white/90">
              {truncateAddress(connectedAddress)}
            </span>
            <span className="ml-auto flex-shrink-0 rounded-full bg-[#10b981]/20 px-2 py-0.5 font-body text-[10px] font-semibold text-[#10b981]">
              Connected
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={walletStatus === "connecting"}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 font-body text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {walletStatus === "connecting" ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                Connect Wallet
              </>
            )}
          </button>
        )}

        {/* Wallet error */}
        {walletStatus === "error" && walletError && (
          <p className="mb-3 font-body text-[11px] text-red-300" role="alert" aria-live="assertive">
            {walletError}
          </p>
        )}

        {/* Bottom row: address + transfer button */}
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-body text-xs text-white/70">
            {walletAddress}
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 rounded-full bg-[#f48d79] px-4 py-2 min-h-[44px] font-body text-xs font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95"
          >
            Transfer to Wallet
          </button>
        </div>
      </div>

      {/* Transfer Modal */}
      <TransferModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        balance={balance}
        phpEquivalent={phpEquivalent}
        walletAddress={walletAddress}
        onTransferSuccess={() => {
          setModalOpen(false);
          onTransferSuccess?.();
        }}
      />
    </>
  );
}
