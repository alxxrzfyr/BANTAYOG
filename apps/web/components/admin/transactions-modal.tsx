"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/api";

interface TransactionItem {
  category: string;
  name: string;
  quantity: number;
  unitPricePhp: number;
  creditCost: number;
}

interface Transaction {
  id: string;
  createdAt: string;
  totalCreditDeducted: number;
  items: TransactionItem[];
  beneficiary?: {
    childName: string;
    guardianName: string;
    cardSerial: string;
  };
  merchant?: {
    storeName: string;
    ownerName: string;
    mobileNumberE164: string;
  };
}

interface TransactionsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  merchantId?: string;
  beneficiaryId?: string;
}

const LIMIT = 5;

export function TransactionsModal({
  open,
  onClose,
  title,
  subtitle,
  merchantId,
  beneficiaryId,
}: TransactionsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/transactions?limit=${LIMIT}&page=${currentPage}`;
      if (merchantId) url += `&merchantId=${merchantId}`;
      if (beneficiaryId) url += `&beneficiaryId=${beneficiaryId}`;

      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error("Failed to load transaction history");
      }
      const result = await res.json();
      setTransactions(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [merchantId, beneficiaryId]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchTransactions(1);
    }
  }, [open, fetchTransactions]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTransactions(newPage);
  };

  if (!open) return null;

  const totalPages = Math.ceil(totalCount / LIMIT);
  const startIdx = (page - 1) * LIMIT + 1;
  const endIdx = Math.min(page * LIMIT, totalCount);

  // Helper to render beautiful SVGs based on product category
  const renderProductIcon = (category: string) => {
    const strokeColor = "#034C52";
    switch (category?.toUpperCase()) {
      case "EGGS":
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" className="text-brand-darkTeal">
            <ellipse cx="12" cy="12" rx="7" ry="9" />
            <path d="M12 3v18M5 12h14" strokeOpacity="0.2" />
          </svg>
        );
      case "FRESH_MILK":
      case "POWDERED_MILK":
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" className="text-brand-darkTeal">
            <path d="M9 2h6v3H9zM7 5h10v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5z" />
            <circle cx="12" cy="13" r="2.5" />
          </svg>
        );
      case "RICE_BROWN":
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" className="text-brand-darkTeal">
            <path d="M6 3h12l3 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10l3-7z" />
            <path d="M12 3v20M3 10h18" strokeOpacity="0.2" />
          </svg>
        );
      default:
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" className="text-brand-darkTeal">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 9h6M9 13h6M9 17h3" strokeOpacity="0.5" />
          </svg>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + "\n" + d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-[850px] bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in border border-brand-sageBorder/50">
        
        {/* Header */}
        <div className="px-8 pt-7 pb-4 flex justify-between items-start border-b border-gray-100">
          <div>
            <h3 className="font-body text-xl font-bold text-brand-darkTeal">
              Transaction History - {title}
            </h3>
            <p className="text-xs font-semibold text-brand-darkTeal/50 mt-1 uppercase tracking-wider font-body">
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors text-brand-darkTeal/70 cursor-pointer"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin h-8 w-8 text-brand-activeTeal" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 font-medium text-sm font-body">{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-brand-darkTeal/40 text-sm font-medium font-body">
              No transactions recorded.
            </div>
          ) : (
            <div className="w-full">
              {/* Header Titles */}
              <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-brand-darkTeal/40 uppercase tracking-widest pb-3 border-b border-gray-100 font-body">
                <div className="col-span-2">Date & Time</div>
                <div className="col-span-3">{merchantId ? "Beneficiary" : "Merchant"}</div>
                <div className="col-span-4">Product</div>
                <div className="col-span-1 text-center">Quantity</div>
                <div className="col-span-2 text-right">Price (PHPC)</div>
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <div key={tx.id} className="py-4 space-y-3">
                    <div className="grid grid-cols-12 gap-4 items-start">
                      
                      {/* Date & Time */}
                      <div className="col-span-2 text-xs font-semibold text-brand-darkTeal/70 whitespace-pre-line leading-relaxed font-body">
                        {formatDate(tx.createdAt)}
                      </div>

                      {/* Beneficiary/Merchant */}
                      <div className="col-span-3 font-body">
                        {merchantId ? (
                          tx.beneficiary ? (
                            <div>
                              <p className="text-xs font-bold text-brand-darkTeal">
                                {tx.beneficiary.childName}
                              </p>
                              <p className="text-[10px] font-semibold text-brand-activeTeal font-mono mt-0.5">
                                {tx.beneficiary.cardSerial}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )
                        ) : (
                          tx.merchant ? (
                            <div>
                              <p className="text-xs font-bold text-brand-darkTeal">
                                {tx.merchant.storeName}
                              </p>
                              <p className="text-[10px] font-semibold text-brand-darkTeal/60 mt-0.5">
                                {tx.merchant.ownerName}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )
                        )}
                      </div>

                      {/* Products block */}
                      <div className="col-span-7 space-y-4">
                        {tx.items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-7 gap-4 items-center">
                            {/* Product Info */}
                            <div className="col-span-4 flex items-center gap-3 font-body">
                              <div className="w-10 h-10 rounded-xl bg-brand-peachBg/40 border border-brand-sageBorder/20 flex items-center justify-center flex-shrink-0">
                                {renderProductIcon(item.category)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-brand-darkTeal truncate">
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-brand-darkTeal/40 mt-0.5 truncate uppercase font-semibold tracking-wider">
                                  {item.category?.replace("_", " ")}
                                </p>
                              </div>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-1 text-center text-xs font-bold text-brand-darkTeal font-body">
                              {item.quantity}
                            </div>

                            {/* Price */}
                            <div className="col-span-2 text-right text-xs font-bold text-brand-darkTeal/80 font-body">
                              {item.creditCost} PHPC
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subtotal row */}
                    <div className="flex justify-end pr-0 font-body">
                      <p className="text-xs font-bold text-brand-darkTeal/40">
                        Subtotal: <span className="text-brand-darkTeal font-extrabold text-sm ml-1">{tx.totalCreditDeducted.toLocaleString()} PHPC</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        {!loading && !error && totalCount > 0 && (
          <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-brand-peachBg/10 font-body">
            <span className="text-[11px] font-semibold text-brand-darkTeal/40">
              Showing {startIdx} to {endIdx} of {totalCount} transactions
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-brand-sageBorder/50 text-brand-darkTeal hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                const isSelected = pNum === page;
                return (
                  <button
                    key={pNum}
                    onClick={() => handlePageChange(pNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-brand-darkTeal text-white shadow-sm"
                        : "text-brand-darkTeal/60 hover:bg-white hover:text-brand-darkTeal border border-transparent hover:border-brand-sageBorder/50"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-brand-sageBorder/50 text-brand-darkTeal hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
