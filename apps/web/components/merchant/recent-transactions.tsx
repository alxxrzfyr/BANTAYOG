"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Recent Transactions List — embedded in dashboard (ref: 13.png)
// ---------------------------------------------------------------------------

interface TransactionItem {
  category: string;
  name: string;
  quantity: number;
  unitPricePhp: number;
  creditCost: number;
}

interface Transaction {
  id: string;
  beneficiaryId: string;
  merchantId: string;
  items: TransactionItem[];
  totalCreditDeducted: number;
  stablecoinAmountWei: string;
  onchainTxHash: string | null;
  idempotencyKey: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

interface TransactionsResponse {
  data: Transaction[];
  count: number;
}

async function fetchRecentTransactions(): Promise<Transaction[]> {
  const res = await authFetch("/api/transactions?status=CONFIRMED&limit=3");
  if (!res.ok) {
    throw new Error("Failed to fetch transactions");
  }
  const result: TransactionsResponse = await res.json();
  return result.data || [];
}

export function RecentTransactions() {
  const {
    data: transactions,
    isLoading,
    error,
  } = useQuery<Transaction[]>({
    queryKey: ["merchant-transactions"],
    queryFn: fetchRecentTransactions,
    refetchInterval: 5000, // Poll every 5 seconds for near-real-time
    staleTime: 3000,
    placeholderData: (prev) => prev,
  });

  // Loading state
  if (isLoading && !transactions) {
    return (
      <section aria-live="polite" aria-busy="true">
        <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recent Transactions
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-gray-200 bg-white px-5 py-4"
            >
              <div className="mb-3 h-4 w-32 rounded bg-gray-200" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-3/4 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error && !transactions) {
    return (
      <section>
        <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recent Transactions
        </h2>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center" role="alert">
          <p className="font-body text-sm text-gray-500">
            Unable to load transactions
          </p>
        </div>
      </section>
    );
  }

  // Empty state
  if (!transactions || transactions.length === 0) {
    return (
      <section>
        <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recent Transactions
        </h2>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
          <p className="font-body text-sm text-gray-500">
            No transactions yet — your first sale is just a scan away!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
        Recent Transactions
      </h2>

      <div className="space-y-4">
        {transactions.map((txn) => {
          const formattedTotal = txn.totalCreditDeducted.toFixed(2);
          return (
            <div
              key={txn.id}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-4"
            >
              {/* Header: Transaction ID only (no beneficiary/guardian names) */}
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-body text-[10px] font-semibold text-gray-500">
                  {txn.id}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {(txn.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-baseline justify-between"
                  >
                    <div>
                      <span className="font-body text-sm text-gray-700">
                        {item.name}
                      </span>
                      <span className="ml-2 font-body text-xs text-gray-400">
                        Qty: {item.quantity}
                      </span>
                    </div>
                    <span className="font-body text-sm text-gray-500">
                      ₱{item.creditCost.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-3 border-t border-gray-100 pt-2 text-right">
                <span className="font-body text-lg font-extrabold text-[#034C52]">
                  +{formattedTotal} PHPC
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
