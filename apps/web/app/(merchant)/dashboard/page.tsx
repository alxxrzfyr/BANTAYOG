"use client";

import Link from "next/link";
import { WalletBalanceCard } from "@/components/merchant/wallet-balance-card";

// ---------------------------------------------------------------------------
// Mock data — will be replaced with real API calls in Phase 3
// ---------------------------------------------------------------------------

const MOCK_MERCHANT = {
  storeName: "Maria's Sari-Sari Store",
  walletAddress: "ronin:7a3b8c2d4e5f6a1b9c0d2e3f4a5b6c7d8e9f0a1b",
  balance: "0.00",
  phpEquivalent: "0.00",
};

const MOCK_TRANSACTIONS = [
  {
    id: "TXN-902381",
    beneficiaryName: "Juan Dela Cruz",
    items: [
      { name: "Evaporated Milk", qty: 2, cost: "45.00" },
      { name: "Brown Rice 1kg", qty: 1, cost: "55.00" },
      { name: "Eggs (10 pcs)", qty: 1, cost: "75.00" },
    ],
    totalPHPC: "175.00",
  },
  {
    id: "TXN-902382",
    beneficiaryName: "Ana Santos",
    items: [
      { name: "Instant Oatmeal", qty: 3, cost: "37.50" },
      { name: "Fresh Milk 1L", qty: 1, cost: "85.00" },
    ],
    totalPHPC: "122.50",
  },
];

// ---------------------------------------------------------------------------
// Merchant Dashboard — matches merchantPages/13.png
// ---------------------------------------------------------------------------

export default function MerchantDashboard() {
  // In Phase 3, these will come from API calls:
  // - GET /api/merchants (profile + wallet address)
  // - GET /api/chain/balance (PHPC balance)
  // - GET /api/transactions (recent transactions filtered by merchant)

  return (
    <div className="min-h-dvh bg-[#fdf2ed]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-[#fdf2ed] px-5 py-4">
        {/* Left: profile icon + store info */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/merchantLogos/profile.png"
            alt=""
            className="h-11 w-11 rounded-full border-2 border-[#034C52]/20 bg-[#034C52]"
          />
          <div>
            <h1 className="font-body text-sm font-bold text-[#034C52]">
              {MOCK_MERCHANT.storeName}
            </h1>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-[#a8d5ba] bg-[#f0faf3] px-2 py-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/merchantLogos/verifiedBadge.png"
                alt=""
                className="h-3.5 w-3.5"
              />
              <span className="font-body text-[10px] font-semibold text-[#034C52]">
                LGU Verified Store
              </span>
            </div>
          </div>
        </div>

        {/* Right: BANTAYOG logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/merchantLogos/darkTitle.png"
          alt="BANTAYOG"
          className="h-14 w-auto"
        />
      </header>

      {/* ── Content ── */}
      <div className="space-y-7 px-5 py-6">
        {/* 1. Wallet Balance Card */}
        <WalletBalanceCard
          balance={MOCK_MERCHANT.balance}
          phpEquivalent={MOCK_MERCHANT.phpEquivalent}
          walletAddress={MOCK_MERCHANT.walletAddress}
        />

        {/* 2. Merchant Actions — Scan Cart Items */}
        <section>
          <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
            Merchant Actions
          </h2>
          <Link
            href="/scan"
            className="flex items-center gap-4 rounded-2xl bg-[#f48d79] px-5 py-5 transition-colors hover:bg-[#f9a899] active:brightness-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/camera.png"
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-xl"
            />
            <div className="flex-1">
              <p className="font-body text-base font-bold text-[#034C52]">
                Scan Cart Items
              </p>
              <p className="font-body text-sm text-[#034C52]/60">
                Verify and process cart items
              </p>
            </div>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#034C52"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </section>

        {/* 3. Recent Transactions */}
        <section>
          <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
            Recent Transactions
          </h2>

          <div className="space-y-4">
            {MOCK_TRANSACTIONS.map((txn) => (
              <div
                key={txn.id}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-4"
              >
                {/* Header: name + txn id */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-body text-sm font-bold text-[#034C52]">
                    {txn.beneficiaryName}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-body text-[10px] font-semibold text-gray-500">
                    {txn.id}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {txn.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-baseline justify-between"
                    >
                      <div>
                        <span className="font-body text-sm text-gray-700">
                          {item.name}
                        </span>
                        <span className="ml-2 font-body text-xs text-gray-400">
                          Qty: {item.qty}
                        </span>
                      </div>
                      <span className="font-body text-sm text-gray-500">
                        {item.cost}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-3 border-t border-gray-100 pt-2 text-right">
                  <span className="font-body text-lg font-extrabold text-[#034C52]">
                    +{txn.totalPHPC} PHPC
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
