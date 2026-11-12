"use client";

import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "@/components/admin/status-bar";
import { SettlementListView } from "@/components/admin/settlement-list";
import { listSettlements } from "@/lib/settlements/api";

/* ─────────────────────────────────────────────────────────
   Settlements — /admin/settlements. Program officer queue of
   store settlement claims (PayPal Invoicing, sandbox).
   Contract: docs/designs/paypal-settlement.md §6–7.
   ───────────────────────────────────────────────────────── */

export default function AdminSettlementsPage() {
  const query = useQuery({ queryKey: ["admin-settlements"], queryFn: () => listSettlements() });

  return (
    <div className="space-y-5 animate-fade-in">
      <StatusBar />
      <div>
        <h1 className="text-xl font-bold text-brand-darkTeal md:text-2xl">Settlements</h1>
        <p className="mt-1 text-sm text-brand-darkTeal/75">
          Check each store claim and its proof, then approve to send a PayPal invoice.
        </p>
      </div>
      <SettlementListView
        invoices={query.data ?? null}
        loading={query.isLoading}
        error={query.isError && !query.data ? (query.error as Error).message : null}
        onRetry={() => void query.refetch()}
      />
    </div>
  );
}
