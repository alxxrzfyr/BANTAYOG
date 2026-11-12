"use client";

import Link from "next/link";
import { useState } from "react";
import { RegistryPanelSkeleton } from "@/components/admin/skeleton";
import { formatPhp, formatSaleTime, shortId } from "@/lib/settlements/format";
import type { SettlementInvoiceDto, SettlementStatus } from "@/lib/settlements/types";

/* ─────────────────────────────────────────────────────────
   Settlements list — /admin/settlements (presentational).
   Contract: docs/designs/paypal-settlement.md §7.
   Same panel shell as the Merchant Directory. Amounts are shown
   exactly as the API returns them.
   ───────────────────────────────────────────────────────── */

const ZERO = /^0*(\.0*)?$/;

export const STATUS_LABEL: Record<SettlementStatus, string> = {
  PROPOSED: "Needs review",
  SENT: "Waiting for payment",
  PAID: "Paid",
  CANCELLED: "Not approved",
};

const STATUS_STYLE: Record<SettlementStatus, string> = {
  PROPOSED: "border-brand-coral bg-brand-peachLight text-brand-darkTeal",
  SENT: "border-brand-activeTeal bg-brand-activeTeal/5 text-brand-activeTeal",
  PAID: "border-brand-darkTeal bg-brand-darkTeal text-white",
  CANCELLED: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-brand-darkTeal/80",
};

export function SettlementStatusPill({ status }: { status: SettlementStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}
    >
      {status === "PROPOSED" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-coral" />}
      {status === "PAID" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

type Filter = SettlementStatus | "ALL";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "PROPOSED", label: "Needs review" },
  { id: "SENT", label: "Waiting for payment" },
  { id: "PAID", label: "Paid" },
  { id: "CANCELLED", label: "Not approved" },
  { id: "ALL", label: "All" },
];

const EMPTY_COPY: Record<Filter, string> = {
  PROPOSED: "No claims need review. New claims appear here when a store taps “Get paid”.",
  SENT: "No invoices are waiting for payment.",
  PAID: "No claims have been paid yet.",
  CANCELLED: "No claims have been rejected.",
  ALL: "No store has asked to get paid yet.",
};

export interface SettlementListViewProps {
  invoices: SettlementInvoiceDto[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SettlementListView({ invoices, loading, error, onRetry }: SettlementListViewProps) {
  const [filter, setFilter] = useState<Filter>("PROPOSED");
  const all = invoices ?? [];
  const rows = filter === "ALL" ? all : all.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === "ALL" ? all.length : all.filter((i) => i.status === f).length);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-brand-sageBorder/30 bg-white shadow-sm">
        <RegistryPanelSkeleton
          columns={6}
          pillColumns={[2, 5]}
          rowClassName="px-6 py-4"
          tableMinWidthClassName="min-w-[760px]"
          ariaLabel="Loading settlements"
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="settlements-heading" className="overflow-hidden rounded-2xl border border-brand-sageBorder/30 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-sageBorder/20 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/80" aria-hidden="true">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <circle cx="12" cy="12.5" r="2.5" />
          </svg>
          <h2 id="settlements-heading" className="text-sm font-bold text-brand-darkTeal">
            Store settlement claims
          </h2>
        </div>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-colors duration-200 cursor-pointer ${
                  active
                    ? "bg-brand-darkTeal text-white"
                    : "border border-brand-sageBorder/60 text-brand-darkTeal/80 hover:bg-brand-peachBg/50 hover:text-brand-darkTeal"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? "bg-white/20 text-white" : "bg-brand-peachBg text-brand-darkTeal"}`}
                >
                  {count(f.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-brand-darkTeal">Settlement claims could not be loaded.</p>
          <p className="max-w-xl text-xs text-brand-darkTeal/80">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-brand-darkTeal px-5 py-2.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-brand-activeTeal cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm font-semibold text-brand-darkTeal/80">{EMPTY_COPY[filter]}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-brand-sageBorder/20 bg-brand-peachBg/40">
                {["Store", "Prepared", "Status", "Held", "Amount to pay", ""].map((h, i) => (
                  <th
                    key={h || "action"}
                    scope="col"
                    className={`px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-brand-darkTeal/80 ${i >= 3 && i <= 4 ? "text-right" : "text-left"}`}
                  >
                    {h || <span className="sr-only">Action</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="stagger-children divide-y divide-brand-sageBorder/10">
              {rows.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-brand-peachBg/20">
                  <td className="px-6 py-4 align-middle">
                    <p className="text-sm font-bold text-brand-darkTeal">{inv.storeName}</p>
                    <p className="mt-0.5 text-xs text-brand-darkTeal/80">Claim {shortId(inv.id)}</p>
                  </td>
                  <td className="px-6 py-4 align-middle text-sm text-brand-darkTeal/80">{formatSaleTime(inv.createdAt)}</td>
                  <td className="px-6 py-4 align-middle">
                    <SettlementStatusPill status={inv.status} />
                  </td>
                  <td className="px-6 py-4 text-right align-middle text-sm tabular-nums text-brand-darkTeal/80">
                    {ZERO.test(inv.heldAmountPhp) ? "—" : formatPhp(inv.heldAmountPhp)}
                  </td>
                  <td className="px-6 py-4 text-right align-middle text-base font-extrabold tabular-nums text-brand-darkTeal">
                    {formatPhp(inv.totalAmountPhp)}
                  </td>
                  <td className="px-6 py-4 text-right align-middle">
                    <Link
                      href={`/admin/settlements/${inv.id}`}
                      aria-label={`${inv.status === "PROPOSED" ? "Review" : "View"} claim from ${inv.storeName}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                        inv.status === "PROPOSED"
                          ? "bg-brand-darkTeal text-white hover:bg-brand-activeTeal"
                          : "border border-brand-darkTeal/40 text-brand-darkTeal hover:bg-brand-darkTeal hover:text-white"
                      }`}
                    >
                      {inv.status === "PROPOSED" ? "Review" : "View"}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
