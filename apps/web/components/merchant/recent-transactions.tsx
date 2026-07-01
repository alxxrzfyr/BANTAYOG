"use client";

import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Recent Transactions List — embedded in dashboard (ref: 13.png)
// ---------------------------------------------------------------------------

interface TransactionItem {
  name: string;
  qty: number;
  cost: string;
}

interface Transaction {
  id: string;
  beneficiaryName: string;
  items: TransactionItem[];
  totalPHPC: string;
}

// Mock data — will be replaced with real API call
const MOCK_TRANSACTIONS: Transaction[] = [
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

async function fetchTransactions(): Promise<Transaction[]> {
  // TODO: Replace with real API call to GET /api/transactions
  // const res = await fetch("/api/transactions?limit=2");
  // if (!res.ok) throw new Error("Failed to fetch transactions");
  // return res.json();

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_TRANSACTIONS;
}

export function RecentTransactions() {
  const {
    data: transactions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["merchant-transactions"],
    queryFn: fetchTransactions,
    refetchInterval: 5000, // Poll every 5 seconds for near-real-time
    staleTime: 3000,
  });

  // Loading state
  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recent Transactions
        </h2>
        <div className="space-y-4">
          {[1, 2].map((i) => (
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
  if (error) {
    return (
      <section>
        <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recent Transactions
        </h2>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center">
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
        {transactions.map((txn) => (
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
  );
}
