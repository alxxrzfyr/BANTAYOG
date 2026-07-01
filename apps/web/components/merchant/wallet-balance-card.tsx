"use client";

import { useState } from "react";
import { TransferModal } from "./transfer-modal";

// ---------------------------------------------------------------------------
// Wallet Balance Card — matches the dark teal card in merchantPages/13.png
// ---------------------------------------------------------------------------

interface WalletBalanceCardProps {
  /** PHPC balance (displayed as-is, e.g. "0.00") */
  balance: string;
  /** PHP equivalent (1:1 peg, displayed as "P0.00") */
  phpEquivalent: string;
  /** Merchant's Ronin wallet address (truncated display) */
  walletAddress: string;
  /** Called after a successful transfer so parent can refresh data */
  onTransferSuccess?: () => void;
}

export function WalletBalanceCard({
  balance,
  phpEquivalent,
  walletAddress,
  onTransferSuccess,
}: WalletBalanceCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl bg-[#034C52] px-6 py-7 text-white">
        {/* Top row: label + wallet icon */}
        <div className="mb-1 flex items-start justify-between">
          <p className="font-body text-xs font-semibold uppercase tracking-wider text-[#f48d79]">
            Digital Wallet Balance
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/merchantLogos/wallet.png"
            alt=""
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

        {/* Bottom row: address + transfer button */}
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-body text-xs text-white/70">
            {walletAddress}
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 rounded-full bg-[#f48d79] px-4 py-2 font-body text-xs font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95"
          >
            Transfer to Ronin Wallet
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
