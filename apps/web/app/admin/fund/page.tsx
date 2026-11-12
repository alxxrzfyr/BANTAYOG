"use client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { FundLedgerView } from "@/components/admin/fund-ledger";
import { getFundLedger } from "@/lib/fund/api";

export default function AdminFundPage() {
  const query = useQuery({ queryKey: ["fund-ledger"], queryFn: getFundLedger });
  return <div className="space-y-5">
    <div className="flex justify-end"><Button variant="outline" className="min-h-[44px]" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Checking…" : "Refresh fund ledger"}</Button></div>
    {query.isPending ? <p role="status" className="text-sm text-brand-darkTeal">Loading fund ledger…</p> : query.isError ? <p role="alert" className="rounded-xl bg-white p-5 text-sm text-brand-darkTeal">Unable to load the fund ledger. Check your connection and try again.</p> : <FundLedgerView ledger={query.data} />}
  </div>;
}
