"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatPhp, formatSaleTime, shortId } from "@/lib/settlements/format";
import { merchantStage } from "@/lib/settlements/merchant-stage";
import type {
  MerchantSettlementOverviewDto,
  SettlementInvoiceDto,
  SettlementLineDto,
} from "@/lib/settlements/types";

/* ─────────────────────────────────────────────────────────
   "Get paid" — merchant settlement screen (presentational).
   Contract: docs/designs/paypal-settlement.md §7.
   Shows what the API returns. No total, price or eligibility
   decision happens here. The page container owns data fetching.
   ───────────────────────────────────────────────────────── */

export interface MerchantSettlementViewProps {
  overview: MerchantSettlementOverviewDto;
  /** Detail (with lines) of the open, just-proposed or just-paid invoice */
  invoice: SettlementInvoiceDto | null;
  invoiceError: string | null;
  proposing: boolean;
  checking: boolean;
  actionError: string | null;
  notice: string | null;
  onGetPaid: () => void;
  onCheckStatus: () => void;
  onReload: () => void;
}

type Display =
  | { kind: "empty" | "waiting" | "ready"; lastClosed: SettlementInvoiceDto | null }
  | { kind: "proposing" }
  | { kind: "proposed" | "sent" | "paid"; invoice: SettlementInvoiceDto };

const ZERO = /^0*(\.0*)?$/;

function resolveDisplay(
  overview: MerchantSettlementOverviewDto,
  detail: SettlementInvoiceDto | null,
  proposing: boolean,
): Display {
  if (proposing) return { kind: "proposing" };

  // The page selects the latest server response before passing detail to this view.
  const listed = detail ? overview.invoices.find((i) => i.id === detail.id) : undefined;
  let merged = overview;
  if (detail && listed) {
    const current = detail;
    merged = { ...overview, invoices: overview.invoices.map((i) => (i.id === current.id ? current : i)) };
  } else if (detail && (detail.status === "PROPOSED" || detail.status === "SENT")) {
    // Fresh POST response; the overview has not listed it yet.
    return detail.status === "PROPOSED" ? { kind: "proposed", invoice: detail } : { kind: "sent", invoice: detail };
  }

  const stage = merchantStage(merged);
  if (stage.kind === "active") {
    return stage.invoice.status === "PROPOSED"
      ? { kind: "proposed", invoice: stage.invoice }
      : { kind: "sent", invoice: stage.invoice };
  }
  return stage;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function announce(display: Display, overview: MerchantSettlementOverviewDto): string {
  switch (display.kind) {
    case "empty":
      return "Nothing to claim yet.";
    case "waiting":
      return `${plural(overview.waitingForLedgerCount, "sale is", "sales are")} waiting for ledger confirmation.`;
    case "ready":
      return `${formatPhp(overview.unpaidAmountPhp)} is ready to claim.`;
    case "proposing":
      return "Preparing your claim.";
    case "proposed":
      return `Claim of ${formatPhp(display.invoice.totalAmountPhp)} prepared. Waiting for the program officer.`;
    case "sent":
      return `Invoice of ${formatPhp(display.invoice.totalAmountPhp)} sent. Waiting for payment.`;
    case "paid":
      return `PayPal invoice paid. Invoice amount: ${formatPhp(display.invoice.totalAmountPhp)}. The funder paid the program through PayPal. Store payout is a separate step handled by your program.`;
  }
}

/* ── Main view ── */

export function MerchantSettlementView(props: MerchantSettlementViewProps) {
  const { overview, invoice, invoiceError, proposing, actionError, notice } = props;
  const display = resolveDisplay(overview, invoice, proposing);
  const current = "invoice" in display ? display.invoice : null;
  const lines = current?.lines ?? null;
  const pastInvoices = overview.invoices.filter((i) => i.id !== current?.id);
  const lastClosed = "lastClosed" in display ? display.lastClosed : null;
  const cancelled = lastClosed?.status === "CANCELLED"
    ? (invoice?.id === lastClosed.id ? invoice : lastClosed)
    : null;
  const rejectionReasons = [...new Set(cancelled?.lines?.map((l) => l.holdReason).filter((reason) => reason?.trim()) ?? [])];

  return (
    <div className="space-y-7">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce(display, overview)}
      </p>

      <Hero {...props} display={display} />

      {notice && (
        <p className="rounded-2xl border border-brand-sageBorder bg-white px-5 py-4 font-body text-sm text-brand-darkTeal">
          {notice}
        </p>
      )}

      {actionError && (
        <ErrorNote
          message={actionError}
          action={display.kind === "sent" ? props.onCheckStatus : display.kind === "ready" ? props.onGetPaid : props.onReload}
        />
      )}

      {cancelled && (
        <InfoNote title="Your last claim was not approved">
          The program officer closed your claim from {formatSaleTime(cancelled.createdAt)}.{" "}
          {rejectionReasons.length > 0 ? `${rejectionReasons.join(" ")} ` : ""}
          Ask your LGU nutrition office if you have questions.
        </InfoNote>
      )}

      {overview.waitingForLedgerCount > 0 && display.kind !== "waiting" && display.kind !== "proposing" && (
        <InfoNote title={`${plural(overview.waitingForLedgerCount, "sale is", "sales are")} still being confirmed`}>
          They are not in this amount yet. They join your next claim after the ledger confirms them.
          <button type="button" onClick={props.onReload} disabled={props.checking} className="mt-3 block min-h-[44px] font-semibold underline underline-offset-4">
            Check again
          </button>
        </InfoNote>
      )}

      {(display.kind === "proposing" || current) && <Progress display={display} />}

      {display.kind === "proposing" && <AssemblingLines />}

      {current && display.kind !== "paid" && (
        <ClaimLines lines={lines} error={invoiceError} onRetry={props.onReload} />
      )}

      <PastClaims invoices={pastInvoices} paidAmountPhp={overview.paidAmountPhp} />
    </div>
  );
}

/* ── Hero: one dominant figure per state ── */

function Hero({
  display,
  overview,
  checking,
  onGetPaid,
  onCheckStatus,
  onReload,
}: MerchantSettlementViewProps & { display: Display }) {
  let label: string;
  let amount: string;
  let body: ReactNode;
  let action: ReactNode = null;

  switch (display.kind) {
    case "empty":
      label = "Nothing to claim yet";
      amount = overview.unpaidAmountPhp;
      body = "Each confirmed sale adds to this amount. Record a sale, then come back here to get paid.";
      action = (
        <Link href="/cart" className={heroSecondaryAction}>
          Scan cart items
        </Link>
      );
      break;
    case "waiting":
      label = "Ready to claim";
      amount = overview.unpaidAmountPhp;
      body = (
        <span className="inline-flex items-start gap-2">
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-coral animate-pulse-soft" />
          <span>
            {plural(overview.waitingForLedgerCount, "sale is", "sales are")} waiting for ledger confirmation. You can claim
            {overview.waitingForLedgerCount === 1 ? " it" : " them"} after the ledger confirms.
          </span>
        </span>
      );
      action = (
        <button type="button" onClick={onReload} className={heroSecondaryAction}>
          Check again
        </button>
      );
      break;
    case "ready":
      label = "Ready to claim";
      amount = overview.unpaidAmountPhp;
      body = `${plural(overview.unpaidSaleCount, "confirmed sale", "confirmed sales")}. The program officer checks your claim and requests payment to the program through PayPal. Store payout is a separate step handled by your program.`;
      action = (
        <button type="button" onClick={onGetPaid} className={heroPrimaryAction}>
          Get paid
          <ChevronIcon />
        </button>
      );
      break;
    case "proposing":
      label = "Preparing your claim";
      amount = overview.unpaidAmountPhp;
      body = "We are checking each sale against its reference price and writing your invoice. This takes a few seconds.";
      break;
    case "proposed":
      label = "Claim amount";
      amount = display.invoice.totalAmountPhp;
      body = <StatusLine tone="wait">Waiting for the program officer to check and approve.</StatusLine>;
      break;
    case "sent":
      label = "Invoice sent";
      amount = display.invoice.totalAmountPhp;
      body = (
        <StatusLine tone="wait">
          Waiting for payment.{display.invoice.sentAt ? ` Sent ${formatSaleTime(display.invoice.sentAt)}.` : ""}
        </StatusLine>
      );
      action = (
        <button type="button" onClick={onCheckStatus} disabled={checking} className={heroSecondaryAction}>
          {checking ? <Spinner /> : null}
          {checking ? "Checking payment status…" : "Check payment status"}
        </button>
      );
      break;
    case "paid":
      label = "PayPal invoice paid";
      amount = display.invoice.totalAmountPhp;
      body = (
        <StatusLine tone="done">
          Paid{display.invoice.paidAt ? ` ${formatSaleTime(display.invoice.paidAt)}` : ""}. This is the invoice amount. PayPal can deduct its fee. The funder paid the program through PayPal. Store payout is a separate step handled by your program.
        </StatusLine>
      );
      break;
  }

  const held =
    "invoice" in display && display.kind !== "paid" && !ZERO.test(display.invoice.heldAmountPhp)
      ? display.invoice.heldAmountPhp
      : null;

  return (
    <section
      aria-labelledby="claim-hero-label"
      aria-busy={display.kind === "proposing" ? true : undefined}
      className="relative overflow-hidden rounded-2xl bg-brand-darkTeal px-6 py-7 text-white"
    >
      <div key={display.kind} className="animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <h2 id="claim-hero-label" className="font-body text-sm font-semibold text-white/80">
            {label}
          </h2>
          {display.kind === "paid" && (
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-coral text-brand-darkTeal animate-scale-in">
              <CheckIcon size={22} />
            </span>
          )}
        </div>

        <p
          className={`mt-1 font-body text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
            display.kind === "proposing" ? "text-white/60" : "text-white"
          }`}
        >
          {formatPhp(amount)}
        </p>

        {held && (
          <p className="mt-1 font-body text-sm font-medium text-white/80 tabular-nums">
            {formatPhp(held)} held for review, not included
          </p>
        )}

        <div className="mt-4 font-body text-sm leading-relaxed text-white/85">{body}</div>

        {action && <div className="mt-6">{action}</div>}
      </div>
    </section>
  );
}

const heroPrimaryAction =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-coral px-6 font-body text-base font-bold text-brand-darkTeal shadow-md transition-all duration-200 ease-out hover:bg-brand-coralHover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const heroSecondaryAction =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 font-body text-base font-semibold text-white transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

function StatusLine({ tone, children }: { tone: "wait" | "done"; children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-2">
      {tone === "wait" ? (
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-coral animate-pulse-soft" />
      ) : (
        <span aria-hidden="true" className="mt-0.5 flex-shrink-0 text-brand-coral">
          <CheckIcon size={16} />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}

/* ── Progress: who acts next ── */

const STEPS = [
  { title: "Officer review", who: "The program officer checks each sale and approves." },
  { title: "PayPal payment", who: "The funder pays the program through PayPal." },
  { title: "Invoice paid", who: "The PayPal invoice is paid. Store payout is separate." },
] as const;

function Progress({ display }: { display: Display }) {
  const currentIndex =
    display.kind === "proposing" || display.kind === "proposed" ? 0 : display.kind === "sent" ? 1 : display.kind === "paid" ? 3 : -1;
  if (currentIndex < 0) return null;

  return (
    <section aria-labelledby="claim-progress-heading">
      <h2 id="claim-progress-heading" className="mb-3 font-body text-sm font-semibold text-brand-darkTeal">
        What happens next
      </h2>
      <ol className="rounded-2xl border border-brand-sageBorder/60 bg-white px-5 py-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex || (index === 2 && currentIndex === 3);
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-start gap-3 border-b border-brand-sageBorder/30 py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-body text-xs font-bold transition-colors duration-300 ${
                  done
                    ? "bg-brand-darkTeal text-white"
                    : isCurrent
                      ? "border-2 border-brand-darkTeal bg-white text-brand-darkTeal"
                      : "border border-brand-sageBorder bg-white text-brand-darkTeal/80"
                }`}
              >
                {done ? <CheckIcon size={13} /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={`font-body text-sm font-semibold ${isCurrent || done ? "text-brand-darkTeal" : "text-brand-darkTeal/80"}`}>
                  {step.title}
                  <span className="sr-only">{done ? " (done)" : isCurrent ? " (in progress)" : ""}</span>
                </p>
                {isCurrent && <p className="mt-0.5 font-body text-xs leading-relaxed text-brand-darkTeal/75">{step.who}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ── Proposal assembling (in progress) ── */

function AssemblingLines() {
  return (
    <section aria-label="Preparing the sales in your claim">
      <h2 className="mb-3 font-body text-sm font-semibold text-brand-darkTeal">Sales in this claim</h2>
      <ul className="stagger-children space-y-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 rounded-2xl border border-brand-sageBorder/40 bg-white px-5 py-4">
            <div className="flex-1 space-y-2">
              <div className="animate-shimmer h-3 w-2/5 rounded-full" />
              <div className="animate-shimmer h-3 w-3/5 rounded-full" />
            </div>
            <div className="animate-shimmer h-4 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Lines of the current claim ── */

function itemSummary(line: SettlementLineDto): string {
  const names = line.items.map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name));
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

function ClaimLines({
  lines,
  error,
  onRetry,
}: {
  lines: SettlementLineDto[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <section aria-labelledby="claim-lines-heading">
        <h2 id="claim-lines-heading" className="mb-3 font-body text-sm font-semibold text-brand-darkTeal">
          Sales in this claim
        </h2>
        <ErrorNote message={error} action={onRetry} />
      </section>
    );
  }

  if (!lines) {
    return (
      <section aria-labelledby="claim-lines-heading" aria-busy="true">
        <h2 id="claim-lines-heading" className="mb-3 font-body text-sm font-semibold text-brand-darkTeal">
          Sales in this claim
        </h2>
        <div className="space-y-2" role="status" aria-label="Loading the sales in this claim">
          {[0, 1].map((i) => (
            <div key={i} className="animate-shimmer h-[72px] rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  const included = lines.filter((l) => !l.held);
  const held = lines.filter((l) => l.held);

  return (
    <>
      <section aria-labelledby="claim-lines-heading">
        <h2 id="claim-lines-heading" className="mb-3 flex items-baseline justify-between font-body text-sm font-semibold text-brand-darkTeal">
          Sales in this claim
          <span className="text-xs font-medium text-brand-darkTeal/80">{plural(included.length, "sale", "sales")}</span>
        </h2>
        {included.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-sageBorder bg-white px-5 py-6 text-center font-body text-sm text-brand-darkTeal/75">
            Every sale in this claim is held for review.
          </p>
        ) : (
          <ul className="stagger-children space-y-2">
            {included.map((l) => (
              <li key={l.transactionId} className="rounded-2xl border border-brand-sageBorder/40 bg-white px-5 py-4">
                <LineRow line={l} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {held.length > 0 && (
        <section aria-labelledby="held-lines-heading">
          <h2 id="held-lines-heading" className="mb-1 font-body text-sm font-semibold text-brand-darkTeal">
            Held for review
          </h2>
          <p className="mb-3 font-body text-xs leading-relaxed text-brand-darkTeal/75">
            These sales are not in the claim amount. The program officer can release them.
          </p>
          <ul className="space-y-2">
            {held.map((l) => (
              <li key={l.transactionId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-warning-bg)] px-5 py-4">
                <LineRow line={l} />
                <p className="mt-3 flex items-start gap-2 border-t border-[var(--color-border)] pt-3 font-body text-sm leading-relaxed text-brand-darkTeal">
                  <span aria-hidden="true" className="mt-0.5 flex-shrink-0">
                    <AlertIcon />
                  </span>
                  <span>
                    <span className="font-semibold">Held: </span>
                    {l.holdReason ?? "The program officer will check this sale."}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function LineRow({ line }: { line: SettlementLineDto }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-body text-sm font-semibold text-brand-darkTeal">Sale {shortId(line.transactionId)}</p>
        <p className="mt-0.5 truncate font-body text-sm text-brand-darkTeal/80">{itemSummary(line)}</p>
        <p className="mt-0.5 font-body text-xs text-brand-darkTeal/80">{formatSaleTime(line.soldAt)}</p>
      </div>
      <p className="flex-shrink-0 font-body text-base font-bold text-brand-darkTeal tabular-nums">{formatPhp(line.amountPhp)}</p>
    </div>
  );
}

/* ── Past claims ── */

const PAST_LABEL: Record<SettlementInvoiceDto["status"], string> = {
  PROPOSED: "With the officer",
  SENT: "Waiting for payment",
  PAID: "Invoice paid",
  CANCELLED: "Not approved",
};

function PastClaims({ invoices, paidAmountPhp }: { invoices: SettlementInvoiceDto[]; paidAmountPhp: string }) {
  if (invoices.length === 0 && ZERO.test(paidAmountPhp)) return null;

  if (invoices.length === 0) {
    return (
      <p className="flex items-center justify-between gap-4 rounded-2xl border border-brand-sageBorder/40 bg-white px-5 py-3.5 font-body text-sm text-brand-darkTeal">
        Paid invoice total so far
        <span className="font-bold tabular-nums">{formatPhp(paidAmountPhp)}</span>
      </p>
    );
  }

  return (
    <section aria-labelledby="past-claims-heading">
      <h2 id="past-claims-heading" className="mb-3 flex items-baseline justify-between font-body text-sm font-semibold text-brand-darkTeal">
        Past claims
        <span className="text-xs font-medium text-brand-darkTeal/80 tabular-nums">Paid invoice total {formatPhp(paidAmountPhp)}</span>
      </h2>
      <ul className="divide-y divide-brand-sageBorder/30 rounded-2xl border border-brand-sageBorder/40 bg-white">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold text-brand-darkTeal">{formatSaleTime(inv.paidAt ?? inv.createdAt)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-body text-xs font-medium text-brand-darkTeal/75">
                  {inv.status === "PAID" && (
                    <span className="text-brand-activeTeal" aria-hidden="true">
                      <CheckIcon size={12} />
                    </span>
                  )}
                  {PAST_LABEL[inv.status]}
                </p>
              </div>
              <p
                className={`flex-shrink-0 font-body text-sm font-bold tabular-nums ${
                  inv.status === "CANCELLED" ? "text-brand-darkTeal/80" : "text-brand-darkTeal"
                }`}
              >
                {formatPhp(inv.totalAmountPhp)}
              </p>
            </li>
          ))}
      </ul>
    </section>
  );
}

/* ── Notes, skeleton, error ── */

function InfoNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-sageBorder/60 bg-brand-peachLight px-5 py-4">
      <span aria-hidden="true" className="mt-0.5 flex-shrink-0 text-brand-darkTeal">
        <InfoIcon />
      </span>
      <div>
        <p className="font-body text-sm font-semibold text-brand-darkTeal">{title}</p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-brand-darkTeal/80">{children}</p>
      </div>
    </div>
  );
}

function ErrorNote({ message, action }: { message: string; action: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-error-bg)] px-5 py-4">
      <p className="flex items-start gap-2 font-body text-sm leading-relaxed text-brand-darkTeal">
        <span aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--color-secondary-700)]">
          <AlertIcon />
        </span>
        <span>{message}</span>
      </p>
      <button
        type="button"
        onClick={action}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-brand-darkTeal bg-white px-5 font-body text-sm font-semibold text-brand-darkTeal transition-colors hover:bg-brand-peachBg active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

export function MerchantSettlementSkeleton() {
  return (
    <div className="space-y-7" role="status" aria-label="Loading your claims">
      <div className="rounded-2xl bg-brand-darkTeal px-6 py-7" aria-hidden="true">
        <div className="h-4 w-28 rounded-full bg-white/15" />
        <div className="mt-3 h-9 w-48 rounded-lg bg-white/20 animate-pulse-soft" />
        <div className="mt-5 h-3 w-full rounded-full bg-white/10" />
        <div className="mt-2 h-3 w-3/4 rounded-full bg-white/10" />
        <div className="mt-6 h-[52px] w-full rounded-xl bg-white/10" />
      </div>
      <div className="space-y-2" aria-hidden="true">
        <div className="animate-shimmer h-4 w-32 rounded-full" />
        <div className="animate-shimmer h-[72px] rounded-2xl" />
        <div className="animate-shimmer h-[72px] rounded-2xl" />
      </div>
    </div>
  );
}

export function MerchantSettlementError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-brand-sageBorder/60 bg-white px-6 py-8 text-center">
      <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error-bg)] text-[var(--color-secondary-700)]">
        <AlertIcon size={22} />
      </span>
      <h2 className="mt-4 font-body text-base font-bold text-brand-darkTeal">We could not load your claims</h2>
      <p className="mt-1 font-body text-sm leading-relaxed text-brand-darkTeal/80">{message}</p>
      <p className="mt-1 font-body text-xs text-brand-darkTeal/80">Your sales and credits are safe.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brand-darkTeal px-6 font-body text-base font-semibold text-white transition-all duration-200 hover:bg-brand-activeTeal active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

/* ── Icons (same stroke family as the merchant screens) ── */

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
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
