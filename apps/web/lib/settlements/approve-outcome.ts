import { SettlementApiError } from "./api";
import type { SettlementStatus } from "./types";

export function approvalRelease(requested: string[], firstRelease: string[] | null, selectionFixed: boolean): string[] {
  return firstRelease ?? (selectionFixed ? [] : requested);
}

export function isResultUnknown(error: unknown): boolean {
  return !(error instanceof SettlementApiError) || error.status === 0 || error.status === 408 || error.status >= 500;
}

export function approveRecovery(status: SettlementStatus | null): { locked: boolean; message: string } {
  switch (status) {
    case "PROPOSED":
      return { locked: false, message: "The claim is still proposed. You can approve again safely. The first approval fixes the sale selection." };
    case "SENT":
      return { locked: false, message: "The PayPal invoice was sent. You can open it below." };
    case "PAID":
      return { locked: false, message: "PayPal reports the invoice as paid." };
    case "CANCELLED":
      return { locked: false, message: "The claim is closed and was not approved." };
    case null:
      return { locked: true, message: "The approval result is not known yet. Check the invoice status before you continue." };
  }
}

export function settlementControls(status: SettlementStatus, pending: boolean, unknown: boolean, selectionFixed: boolean) {
  const canApprove = status === "PROPOSED" && !pending && !unknown;
  return { canApprove, canEdit: canApprove && !selectionFixed };
}
