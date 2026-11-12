"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MerchantSettlementError,
  MerchantSettlementSkeleton,
  MerchantSettlementView,
} from "@/components/merchant/settlement-view";
import {
  getMerchantSettlement,
  getMerchantSettlementOverview,
  refreshMerchantSettlement,
  requestMerchantSettlement,
  SettlementApiError,
} from "@/lib/settlements/api";
import { formatPhp } from "@/lib/settlements/format";
import { merchantStage } from "@/lib/settlements/merchant-stage";
import { pendingProposal, pickDetail, shouldRefetchDetail } from "@/lib/settlements/invoice-sync";
import { createFlightGuard } from "@/lib/settlements/flight-guard";
import type { SettlementInvoiceDto } from "@/lib/settlements/types";

// "Get paid" — /dashboard/settlements. Contract: docs/designs/paypal-settlement.md §6–7.
// Data wiring only; MerchantSettlementView renders every state.

const OVERVIEW_KEY = ["merchant-settlements"] as const;
const detailKey = (id: string | null) => ["merchant-settlement", id] as const;

function friendlyError(error: unknown): string {
  if (error instanceof SettlementApiError && error.status === 0) return error.message;
  if (error instanceof SettlementApiError && (error.status === 401 || error.status === 403)) {
    return "Your session has ended. Log in again to continue.";
  }
  return "The server could not finish the request. Nothing changed. Try again in a moment.";
}

export default function MerchantSettlementsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const proposalFlight = useRef(createFlightGuard());

  const overviewQuery = useQuery({ queryKey: OVERVIEW_KEY, queryFn: getMerchantSettlementOverview });
  const stage = overviewQuery.data ? merchantStage(overviewQuery.data) : null;
  const focusId = stage && (stage.kind === "active" || stage.kind === "paid") ? stage.invoice.id
    : stage?.lastClosed?.status === "CANCELLED" ? stage.lastClosed.id : null;

  const detailQuery = useQuery({
    queryKey: detailKey(focusId),
    queryFn: () => getMerchantSettlement(focusId as string),
    enabled: Boolean(focusId),
  });
  const listed = overviewQuery.data?.invoices.find((i) => i.id === focusId);
  const needsDetail = shouldRefetchDetail({ listed, cached: detailQuery.data,
    overviewAt: overviewQuery.dataUpdatedAt, cachedAt: detailQuery.dataUpdatedAt });
  const refetchDetail = detailQuery.refetch;
  useEffect(() => {
    if (needsDetail) void refetchDetail();
  }, [needsDetail, overviewQuery.dataUpdatedAt, refetchDetail]);

  const keepDetail = (invoice: SettlementInvoiceDto) => {
    queryClient.setQueryData<SettlementInvoiceDto>(detailKey(invoice.id), (prev) => ({
      ...invoice,
      lines: invoice.lines ?? prev?.lines,
    }));
    // The response may omit lines (e.g. released sales); refetch them.
    void queryClient.invalidateQueries({ queryKey: detailKey(invoice.id) });
    void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
  };

  const propose = useMutation({
    mutationFn: requestMerchantSettlement,
    onMutate: () => {
      setActionError(null);
      setNotice(null);
    },
    onSuccess: keepDetail,
    onError: (error) => {
      if (error instanceof SettlementApiError && error.status === 400) {
        // No eligible sale on the server: show the fresh overview, not a dead end.
        setNotice("No sales are ready to claim right now. Your amount is up to date.");
        void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
        return;
      }
      setActionError(friendlyError(error));
    },
  });

  const refresh = useMutation({
    mutationFn: (id: string) => refreshMerchantSettlement(id),
    onMutate: () => {
      setActionError(null);
      setNotice(null);
    },
    onSuccess: (invoice) => {
      keepDetail(invoice);
      setNotice(
        invoice.status === "PAID"
          ? `PayPal invoice paid. Invoice amount: ${formatPhp(invoice.totalAmountPhp)}. PayPal can deduct its fee.`
          : "Not paid yet. PayPal still shows the invoice as waiting for payment. Check again later.",
      );
    },
    onError: (error) => setActionError(friendlyError(error)),
  });

  const reload = () => {
    setActionError(null);
    setNotice(null);
    void overviewQuery.refetch();
    if (focusId) void detailQuery.refetch();
  };

  const resetProposal = propose.reset;
  const proposalListed = Boolean(propose.data && overviewQuery.data && !pendingProposal(overviewQuery.data, propose.data));
  useEffect(() => {
    if (proposalListed) resetProposal();
  }, [proposalListed, resetProposal]);

  const detail = overviewQuery.data ? pickDetail({
    overview: overviewQuery.data, overviewAt: overviewQuery.dataUpdatedAt,
    cached: focusId ? detailQuery.data : undefined, cachedAt: detailQuery.dataUpdatedAt,
    proposed: propose.data ?? null,
  }) : null;

  let content: React.ReactNode;
  if (overviewQuery.isLoading) {
    content = <MerchantSettlementSkeleton />;
  } else if (!overviewQuery.data) {
    content = <MerchantSettlementError message={friendlyError(overviewQuery.error)} onRetry={reload} />;
  } else {
    content = (
      <MerchantSettlementView
        overview={overviewQuery.data}
        invoice={detail}
        invoiceError={detailQuery.isError && !detail?.lines ? friendlyError(detailQuery.error) : null}
        proposing={propose.isPending}
        checking={refresh.isPending}
        actionError={actionError}
        notice={notice}
        onGetPaid={() => void proposalFlight.current(() => propose.mutateAsync())}
        onCheckStatus={() => {
          const id = detail?.id ?? focusId;
          if (id) refresh.mutate(id);
        }}
        onReload={reload}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-bg-navbar">
      <header className="mx-auto flex max-w-lg items-center gap-3 px-5 pt-12 pb-5">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-brand-darkTeal shadow-sm transition-colors hover:bg-brand-peachBg active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="font-body text-xl font-bold text-brand-darkTeal">Get paid</h1>
          <p className="font-body text-xs text-brand-darkTeal/80">Claim payment for your confirmed sales</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 pb-12">{content}</div>
    </div>
  );
}
