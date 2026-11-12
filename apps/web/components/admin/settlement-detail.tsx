"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PanelCardSkeleton, Rect, TextBar } from "@/components/admin/skeleton";
import { SettlementStatusPill } from "@/components/admin/settlement-list";
import { formatPhp, formatSaleTime, ledgerExplorerUrl, shortHash, shortId } from "@/lib/settlements/format";
import { safePayUrl } from "@/lib/settlements/pay-url";
import { settlementControls } from "@/lib/settlements/approve-outcome";
import type { SettlementInvoiceDto, SettlementLineDto } from "@/lib/settlements/types";

/* ─────────────────────────────────────────────────────────
   Settlement detail — /admin/settlements/[id] (presentational).
   Contract: docs/designs/paypal-settlement.md §6–7.
   The officer reads the proof for each sale, may release held
   sales, then approves (server creates + sends the PayPal
   invoice) or rejects. Totals come from the API only.
   ───────────────────────────────────────────────────────── */

export type SettlementAction = "approve" | "reject" | "refresh";

export interface SettlementDetailViewProps {
  invoice: SettlementInvoiceDto;
  pending: SettlementAction | null;
  actionError: string | null;
  notice: string | null;
  approvalUnknown?: boolean;
  selectionFixed?: boolean;
  onApprove: (releaseTransactionIds: string[]) => void;
  onReject: (reason: string) => void;
  onRefresh: () => void;
}

const ZERO = /^0*(\.0*)?$/;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function categoryLabel(category: string): string {
  const words = category.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function announce(invoice: SettlementInvoiceDto, pending: SettlementAction | null): string {
  if (pending === "approve") return "Creating and sending the PayPal invoice.";
  if (pending === "reject") return "Rejecting the claim.";
  if (pending === "refresh") return "Checking the payment status in PayPal.";
  switch (invoice.status) {
    case "PROPOSED":
      return "Waiting for your review.";
    case "SENT":
      return `Invoice for ${formatPhp(invoice.totalAmountPhp)} sent. Waiting for payment.`;
    case "PAID":
      return `Paid: ${formatPhp(invoice.totalAmountPhp)}.`;
    case "CANCELLED":
      return "Claim not approved.";
  }
}

export function SettlementDetailView(props: SettlementDetailViewProps) {
  const { invoice, pending } = props;
  const [released, setReleased] = useState<string[]>([]);
  const lines = invoice.lines ?? [];
  const included = lines.filter((l) => !l.held);
  const held = lines.filter((l) => l.held);
  const selectionFixed = props.selectionFixed || invoice.approved;
  const controls = settlementControls(invoice.status, pending !== null, props.approvalUnknown ?? false, selectionFixed);
  const canRelease = controls.canEdit;

  const toggle = (id: string) =>
    setReleased((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-5">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce(invoice, pending)}
      </p>

      <Link
        href="/admin/settlements"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold text-brand-darkTeal/80 transition-colors hover:text-brand-darkTeal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        All settlements
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border-input/30 bg-bg-card/80 px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-darkTeal md:text-2xl">{invoice.storeName}</h1>
          <p className="mt-1 text-xs text-brand-darkTeal/75">
            Claim {shortId(invoice.id)} · Prepared {formatSaleTime(invoice.createdAt)} · {plural(lines.length, "sale", "sales")}
          </p>
        </div>
        <div key={invoice.status} className="animate-scale-in">
          <SettlementStatusPill status={invoice.status} />
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="ai-summary-heading" className="rounded-2xl border border-brand-sageBorder/30 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ai-summary-heading" className="text-sm font-bold text-brand-darkTeal">
                Summary
              </h2>
              <p className="text-[11px] font-semibold text-brand-darkTeal/80">Written by AI. Check each sale below before you decide.</p>
            </div>
            <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-brand-darkTeal">{invoice.aiSummary}</p>
          </section>

          <section aria-labelledby="included-heading">
            <h2 id="included-heading" className="mb-3 flex items-baseline justify-between text-sm font-bold text-brand-darkTeal">
              Sales in this claim
              <span className="text-xs font-semibold text-brand-darkTeal/80">{plural(included.length, "sale", "sales")}</span>
            </h2>
            {included.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-brand-sageBorder bg-white px-6 py-8 text-center text-sm text-brand-darkTeal/75">
                {canRelease ? "Every sale in this claim is held. Release a held sale to include it, or reject the claim." : "Every sale in this claim is held."}
              </p>
            ) : (
              <ul className="stagger-children space-y-3">
                {included.map((l) => (
                  <li key={l.transactionId}>
                    <SaleProof line={l} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {held.length > 0 && (
            <section aria-labelledby="held-heading">
              <h2 id="held-heading" className="mb-1 text-sm font-bold text-brand-darkTeal">
                Held for review
              </h2>
              <p className="mb-3 text-xs leading-relaxed text-brand-darkTeal/75">
                The price check held {plural(held.length, "sale", "sales")}. Held sales are not in the amount to pay unless you release them.
              </p>
              <ul className="space-y-3">
                {held.map((l) => (
                  <li key={l.transactionId}>
                    <SaleProof line={l}>
                      <div className="border-t border-[var(--color-border)] px-5 py-4">
                        <p className="flex items-start gap-2 text-sm leading-relaxed text-brand-darkTeal">
                          <span aria-hidden="true" className="mt-0.5 flex-shrink-0">
                            <AlertIcon />
                          </span>
                          <span>
                            <span className="font-bold">Why it is held: </span>
                            {l.holdReason ?? "No reason was recorded."}
                          </span>
                        </p>
                        {invoice.status === "PROPOSED" && !selectionFixed && !props.approvalUnknown && (
                          <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-brand-sageBorder bg-white px-4 text-sm font-semibold text-brand-darkTeal transition-colors hover:bg-brand-peachBg/40 has-[:checked]:border-brand-darkTeal">
                            <input
                              type="checkbox"
                              checked={released.includes(l.transactionId)}
                              onChange={() => toggle(l.transactionId)}
                              disabled={!canRelease}
                              className="h-5 w-5 cursor-pointer accent-brand-darkTeal"
                            />
                            Include this sale in the payment
                          </label>
                        )}
                      </div>
                    </SaleProof>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-label="Decision" className="lg:sticky lg:top-24">
          <DecisionPanel {...props} released={released} />
        </aside>
      </div>
    </div>
  );
}

/* ── Proof for one sale ── */

function SaleProof({ line, children }: { line: SettlementLineDto; children?: ReactNode }) {
  return (
    <article
      aria-label={`Sale ${shortId(line.transactionId)}${line.held ? ", held" : ""}`}
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        line.held ? "border-[var(--color-border)] bg-[var(--color-warning-bg)]" : "border-brand-sageBorder/30 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-brand-sageBorder/20 px-5 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-darkTeal">
            Sale {shortId(line.transactionId)}
            {line.held && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-darkTeal/30 bg-white px-2 py-0.5 text-[11px] font-bold text-brand-darkTeal">
                <AlertIcon size={11} />
                Held
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-brand-darkTeal/75">
            <time dateTime={line.soldAt}>{formatSaleTime(line.soldAt)}</time>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {line.ledgerTxHash ? (
            <a
              href={ledgerExplorerUrl(line.ledgerTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              title={line.ledgerTxHash}
              aria-label={`Ledger record ${shortHash(line.ledgerTxHash)}, opens Stellar testnet explorer`}
              className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-mono text-xs font-semibold text-brand-activeTeal underline-offset-4 hover:underline"
            >
              <LedgerIcon />
              {shortHash(line.ledgerTxHash)}
            </a>
          ) : (
            <span className="text-xs font-semibold text-brand-darkTeal/80">No ledger hash</span>
          )}
          <p className="text-base font-extrabold tabular-nums text-brand-darkTeal">{formatPhp(line.amountPhp)}</p>
        </div>
      </div>

      <ul className="divide-y divide-brand-sageBorder/15 px-5">
        {line.items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-center gap-3 py-2.5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-sageBorder/30 bg-brand-peachBg/40 text-brand-darkTeal/80">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <BasketIcon />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-brand-darkTeal">{item.name}</span>
              <span className="block text-[11px] font-medium text-brand-darkTeal/80">{categoryLabel(item.category)}</span>
            </span>
            <span className="flex-shrink-0 text-[13px] font-semibold tabular-nums text-brand-darkTeal">
              {item.quantity} × {formatPhp(item.unitPricePhp)}
            </span>
          </li>
        ))}
      </ul>

      {children}
    </article>
  );
}

/* ── Decision panel ── */

function DecisionPanel({
  invoice,
  pending,
  actionError,
  notice,
  released,
  onApprove,
  onReject,
  onRefresh,
  approvalUnknown = false,
  selectionFixed = false,
}: SettlementDetailViewProps & { released: string[] }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const busy = pending !== null;
  const fixed = selectionFixed || invoice.approved;
  const controls = settlementControls(invoice.status, busy, approvalUnknown, fixed);
  const payUrl = safePayUrl(invoice.payUrl);
  const heldAmount = ZERO.test(invoice.heldAmountPhp) ? null : invoice.heldAmountPhp;

  const figureLabel =
    invoice.status === "PAID" ? "Amount paid" : invoice.status === "CANCELLED" ? "Claim amount" : "Amount to pay";

  return (
    <div className="rounded-2xl border border-brand-sageBorder/30 bg-white px-6 py-6 shadow-sm">
      <p className="text-xs font-semibold text-brand-darkTeal/75">{figureLabel}</p>
      <p
        key={invoice.status}
        className={`mt-1 text-4xl font-black tracking-tight tabular-nums animate-fade-in ${
          invoice.status === "CANCELLED" ? "text-brand-darkTeal/60" : "text-brand-darkTeal"
        }`}
      >
        {formatPhp(invoice.totalAmountPhp)}
      </p>
      {heldAmount && invoice.status !== "PAID" && (
        <p className="mt-1 text-xs font-medium tabular-nums text-brand-darkTeal/75">{formatPhp(heldAmount)} held, not included</p>
      )}

      <div className="my-5 h-px bg-brand-sageBorder/30" />

      {invoice.status === "PROPOSED" && (
        <>
          <p className="text-sm leading-relaxed text-brand-darkTeal">
            <span className="font-semibold tabular-nums">{`Creates and sends a PayPal invoice for ${formatPhp(invoice.totalAmountPhp)}`}</span>
            {!fixed && released.length > 0 ? (
              <>
                {" "}plus the {plural(released.length, "released sale", "released sales")}. The server sets the final total.
              </>
            ) : (
              "."
            )}{" "}
            You then pay it in PayPal.
          </p>

          <button
            type="button"
            onClick={() => onApprove(fixed ? [] : released)}
            disabled={!controls.canApprove}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-500)] px-6 text-base font-semibold text-white shadow-md transition-all duration-200 ease-out hover:bg-[var(--color-primary-600)] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none cursor-pointer"
          >
            {pending === "approve" ? <Spinner /> : <SendIcon />}
            {pending === "approve" ? "Sending invoice…" : approvalUnknown ? "Approval result not known yet" : fixed ? "Approve again safely" : "Approve and send invoice"}
          </button>

          {fixed && <p className="mt-3 text-xs text-brand-darkTeal/75">The first approval fixes the sale selection. This claim cannot be rejected.</p>}
          {approvalUnknown && <RefreshButton pending={pending} busy={busy} onRefresh={onRefresh} label="Check invoice status" />}

          {!fixed && !approvalUnknown && (!rejecting ? (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={!controls.canEdit}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl px-6 text-sm font-semibold text-[var(--color-secondary-700)] transition-colors hover:bg-[var(--color-error-bg)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              Reject claim
            </button>
          ) : (
            <form
              className="mt-4 animate-fade-in space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (controls.canEdit && reason.trim()) onReject(reason.trim());
              }}
            >
              <label htmlFor="reject-reason" className="block text-sm font-semibold text-brand-darkTeal">
                Reason for rejecting
              </label>
              <textarea
                id="reject-reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="For example: prices do not match the store receipts."
                className="input-field resize-none text-sm"
              />
              <p className="text-xs leading-relaxed text-brand-darkTeal/75">No invoice is sent. The claim closes.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  disabled={busy}
                  className="min-h-[44px] flex-1 rounded-xl px-4 text-sm font-semibold text-brand-darkTeal transition-colors hover:bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!controls.canEdit || !reason.trim()}
                  className="min-h-[44px] flex-1 rounded-xl bg-[var(--color-secondary-700)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-secondary-800)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {pending === "reject" ? "Rejecting…" : "Reject claim"}
                </button>
              </div>
            </form>
          ))}
        </>
      )}

      {invoice.status === "SENT" && (
        <>
          <p className="text-sm leading-relaxed text-brand-darkTeal">
            The invoice was sent{invoice.sentAt ? ` ${formatSaleTime(invoice.sentAt)}` : ""}. Pay it in PayPal, then check the status here.
          </p>
          {payUrl ? (
            <a
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-500)] px-6 text-base font-semibold text-white shadow-md transition-all duration-200 ease-out hover:bg-[var(--color-primary-600)] hover:shadow-lg active:scale-[0.98]"
            >
              Open PayPal invoice
              <ExternalIcon />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="mt-4 text-xs text-brand-darkTeal/75">The pay link is not available.</p>
          )}
          <RefreshButton pending={pending} busy={busy} onRefresh={onRefresh} />
        </>
      )}

      {invoice.status === "PAID" && (
        <div className="animate-scale-in">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-darkTeal">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-darkTeal text-white" aria-hidden="true">
              <CheckIcon />
            </span>
            Paid{invoice.paidAt ? ` ${formatSaleTime(invoice.paidAt)}` : ""}
          </p>
          {payUrl ? (
            <a
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-activeTeal underline-offset-4 hover:underline"
            >
              View PayPal invoice
              <ExternalIcon />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : <p className="mt-4 text-xs text-brand-darkTeal/75">The pay link is not available.</p>}
        </div>
      )}

      {invoice.status === "CANCELLED" && (
        <p className="text-sm leading-relaxed text-brand-darkTeal">Not approved. This claim is closed and no invoice was sent.</p>
      )}

      {notice && <p className="mt-4 rounded-xl bg-brand-peachBg/60 px-4 py-3 text-xs font-medium leading-relaxed text-brand-darkTeal">{notice}</p>}

      {actionError && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-error-bg)] px-4 py-3 text-xs leading-relaxed text-brand-darkTeal">
          <span aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--color-secondary-700)]">
            <AlertIcon size={14} />
          </span>
          <span>{actionError}</span>
        </div>
      )}

      {invoice.paypalInvoiceId && (
        <p className="mt-5 text-[11px] text-brand-darkTeal/80">
          PayPal invoice <span className="font-mono">{invoice.paypalInvoiceId}</span>
        </p>
      )}
    </div>
  );
}

function RefreshButton({ pending, busy, onRefresh, label = "Check payment status" }: { pending: SettlementAction | null; busy: boolean; onRefresh: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-activeTeal px-6 text-sm font-semibold text-brand-activeTeal transition-colors hover:bg-brand-sageBg/30 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
    >
      {pending === "refresh" ? <Spinner /> : null}
      {pending === "refresh" ? "Checking…" : label}
    </button>
  );
}

/* ── Loading and error ── */

export function SettlementDetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading settlement">
      <TextBar className="w-28" />
      <div className="rounded-2xl border border-brand-sageBorder/30 bg-bg-card/80 px-6 py-5">
        <TextBar className="w-1/3" />
        <TextBar className="mt-3 w-1/2" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Rect className="h-28 w-full rounded-2xl" />
          <Rect className="h-40 w-full rounded-2xl" />
          <Rect className="h-40 w-full rounded-2xl" />
        </div>
        <PanelCardSkeleton className="rounded-2xl border border-brand-sageBorder/30 bg-white p-6" ariaLabel="Loading decision panel" />
      </div>
    </div>
  );
}

export function SettlementDetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-brand-sageBorder/30 bg-white px-6 py-14 text-center shadow-sm">
      <p className="text-sm font-semibold text-brand-darkTeal">This settlement could not be loaded.</p>
      <p className="max-w-xl text-xs text-brand-darkTeal/80">{message}</p>
      <div className="flex gap-2">
        <Link
          href="/admin/settlements"
          className="rounded-full border border-brand-darkTeal/40 px-5 py-2.5 text-xs font-bold text-brand-darkTeal transition-colors hover:bg-brand-peachBg/50"
        >
          All settlements
        </Link>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-brand-darkTeal px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-activeTeal cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ── Icons ── */

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
