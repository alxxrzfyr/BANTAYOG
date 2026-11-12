"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SettlementDetailError,
  SettlementDetailSkeleton,
  SettlementDetailView,
} from "@/components/admin/settlement-detail";
import {
  approveSettlement,
  getSettlement,
  refreshSettlement,
  rejectSettlement,
} from "@/lib/settlements/api";
import { formatPhp } from "@/lib/settlements/format";
import { approvalRelease, approveRecovery, isResultUnknown, settlementControls } from "@/lib/settlements/approve-outcome";
import { createFlightGuard } from "@/lib/settlements/flight-guard";
import type { SettlementInvoiceDto } from "@/lib/settlements/types";

/* ─────────────────────────────────────────────────────────
   Settlement detail — /admin/settlements/[id].
   Data wiring only; SettlementDetailView renders every state.
   Contract: docs/designs/paypal-settlement.md §6–7.
   ───────────────────────────────────────────────────────── */

function sentence(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

export default function AdminSettlementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unknownId, setUnknownId] = useState<string | null>(null);
  const [firstApproval, setFirstApproval] = useState<{ id: string; release: string[] } | null>(null);
  const actionFlight = useRef(createFlightGuard());

  const detailKey = ["admin-settlement", id] as const;
  const query = useQuery({ queryKey: detailKey, queryFn: () => getSettlement(id), enabled: Boolean(id) });

  const store = (invoice: SettlementInvoiceDto) => {
    queryClient.setQueryData<SettlementInvoiceDto>(detailKey, (prev) => ({
      ...invoice,
      lines: invoice.lines ?? prev?.lines,
    }));
    // The response may omit lines (e.g. released sales); refetch them.
    void queryClient.invalidateQueries({ queryKey: detailKey });
    void queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
  };

  const reset = () => {
    setActionError(null);
    setNotice(null);
  };

  const recoverApproval = async () => {
    const result = await query.refetch();
    const recovery = approveRecovery(result.isError ? null : result.data?.status ?? null);
    setUnknownId(recovery.locked ? id : null);
    setActionError(recovery.locked ? recovery.message : null);
    setNotice(recovery.locked ? null : recovery.message);
  };

  const approve = useMutation({
    mutationFn: (release: string[]) => approveSettlement(id, release),
    onMutate: (release) => {
      reset();
      setFirstApproval({ id, release });
    },
    onSuccess: store,
    onError: async (error: Error) => {
      setUnknownId(id);
      setActionError(isResultUnknown(error)
        ? approveRecovery(null).message
        : `Approval could not be completed. ${sentence(error.message)} Checking the invoice status.`);
      await recoverApproval();
    },
  });

  const reject = useMutation({
    mutationFn: (reason: string) => rejectSettlement(id, reason),
    onMutate: reset,
    onSuccess: store,
    onError: (error: Error) => setActionError(`The claim was not rejected. ${sentence(error.message)}`),
  });

  const refresh = useMutation({
    mutationFn: () => refreshSettlement(id),
    onMutate: reset,
    onSuccess: (invoice) => {
      store(invoice);
      setNotice(
        invoice.status === "PAID"
          ? `PayPal reports the invoice as paid: ${formatPhp(invoice.totalAmountPhp)}.`
          : "PayPal does not report a payment yet. Pay the invoice in PayPal, then check again.",
      );
    },
    onError: (error: Error) => setActionError(`The status could not be checked. ${sentence(error.message)}`),
  });

  if (query.isLoading) return <SettlementDetailSkeleton />;
  if (!query.data) {
    return (
      <SettlementDetailError
        message={query.error instanceof Error ? query.error.message : "The settlement was not found."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const pending = approve.isPending ? "approve" : reject.isPending ? "reject" : refresh.isPending ? "refresh" : null;
  const approvalUnknown = unknownId === id;
  const firstRelease = firstApproval?.id === id ? firstApproval.release : null;
  const selectionFixed = firstRelease !== null || query.data.approved;
  const controls = settlementControls(query.data.status, pending !== null, approvalUnknown, selectionFixed);

  return (
    <div>
      <SettlementDetailView
        invoice={query.data}
        pending={pending}
        actionError={actionError}
        notice={notice}
        approvalUnknown={approvalUnknown}
        selectionFixed={selectionFixed}
        onApprove={(release) => {
          if (controls.canApprove) void actionFlight.current(() => approve.mutateAsync(approvalRelease(release, firstRelease, selectionFixed)));
        }}
        onReject={(reason) => {
          if (controls.canEdit) void actionFlight.current(() => reject.mutateAsync(reason));
        }}
        onRefresh={() => void actionFlight.current(() => approvalUnknown ? recoverApproval() : refresh.mutateAsync())}
      />
    </div>
  );
}
