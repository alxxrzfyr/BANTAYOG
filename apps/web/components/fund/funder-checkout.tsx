"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CreateFundTopupDto, type FundTopupDto } from "@bantayog/schema";
import { Button } from "@/components/ui";
import { createFundTopup, captureFundTopup } from "@/lib/fund/api";
import { formatPhp, formatSaleTime } from "@/lib/settlements/format";
import { safePayUrl } from "@/lib/settlements/pay-url";

const REQUEST_KEY = "bantayog_fund_request";
const message = (error: unknown) => error instanceof Error && error.name !== "TimeoutError" && error.name !== "AbortError"
  ? error.message : "The connection was interrupted. Retry the same contribution to check its result.";

export function FundReceipt({ receipt }: { receipt: FundTopupDto }) {
  if (receipt.status !== "COMPLETED") return <p role="status">Waiting for PayPal payment confirmation.</p>;
  return (
    <section aria-labelledby="receipt-heading" className="rounded-2xl border border-brand-sageBorder bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-activeTeal">PayPal sandbox receipt</p>
      <h2 id="receipt-heading" className="mt-2 text-2xl font-bold text-brand-darkTeal">Contribution received</h2>
      <p role="status" className="mt-3 text-sm text-brand-darkTeal">PayPal confirmed {formatPhp(receipt.amountPhp)}.</p>
      <dl className="mt-5 space-y-3 text-sm text-brand-darkTeal">
        <div className="flex justify-between gap-4"><dt>Gross contribution</dt><dd className="font-bold tabular-nums">{formatPhp(receipt.amountPhp)}</dd></div>
        <div className="flex justify-between gap-4"><dt>PayPal fee</dt><dd className="tabular-nums">{receipt.feePhp === null ? "Not reported" : formatPhp(receipt.feePhp)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-brand-sageBorder pt-3"><dt>Net contribution</dt><dd className="font-bold tabular-nums">{receipt.netAmountPhp === null ? "Not reported" : formatPhp(receipt.netAmountPhp)}</dd></div>
      </dl>
      <p className="mt-5 break-all text-xs text-brand-darkTeal/75">Capture {receipt.captureId}</p>
      {receipt.completedAt && <p className="mt-1 text-xs text-brand-darkTeal/75">{formatSaleTime(receipt.completedAt)}</p>}
    </section>
  );
}

export function FunderCheckout() {
  const [amount, setAmount] = useState("50.00");
  const [receipt, setReceipt] = useState<FundTopupDto | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [returnOrder, setReturnOrder] = useState<string | null>(null);
  const busy = useRef(false);

  const acceptReceipt = useCallback((result: FundTopupDto) => {
    if (result.status !== "COMPLETED") throw new Error("PayPal has not confirmed this contribution. Check the same payment again.");
    setReceipt(result);
    setReturnOrder(null);
    window.localStorage.removeItem(REQUEST_KEY);
    window.history.replaceState(null, "", "/fund");
  }, []);

  const capture = useCallback(async (orderId: string) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null); setReturnOrder(orderId);
    try { acceptReceipt(await captureFundTopup(orderId)); }
    catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  }, [acceptReceipt]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("result") === "approved") {
      const orderId = query.get("token") ?? "";
      if (/^[A-Z0-9]{17}$/.test(orderId)) void capture(orderId);
      else setError("The PayPal return link is incomplete. Return to your PayPal payment and try again.");
    } else if (query.get("result") === "cancelled") {
      setNotice("Checkout was cancelled. If you already approved a payment, check it in PayPal before you try again.");
      window.history.replaceState(null, "", "/fund");
    }
  }, [capture]);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null); setNotice(null);
    try {
      let previous: unknown;
      try { previous = JSON.parse(window.localStorage.getItem(REQUEST_KEY) ?? "null"); } catch { previous = null; }
      const cached = CreateFundTopupDto.safeParse(previous);
      const parsed = CreateFundTopupDto.safeParse({ requestId: cached.success && cached.data.amountPhp === amount.trim()
        ? cached.data.requestId : crypto.randomUUID(), amountPhp: amount.trim() });
      if (!parsed.success) throw new Error("Enter PHP 1.00 to PHP 100,000.00 with two decimal places.");
      const input = parsed.data;
      // Save before the request. A timeout must reuse this ID and amount.
      window.localStorage.setItem(REQUEST_KEY, JSON.stringify(input));
      const result = await createFundTopup(input);
      if (result.status === "COMPLETED") acceptReceipt(result);
      else {
        const url = safePayUrl(result.approvalUrl);
        if (!url || new URL(url).searchParams.get("token") !== result.orderId) throw new Error("PayPal did not return a valid sandbox checkout link. Retry the same contribution.");
        window.location.assign(url);
      }
    } catch (cause) { setError(message(cause)); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <div className="space-y-5">
      {notice && <p role="status" className="rounded-xl border border-brand-sageBorder bg-white p-4 text-sm text-brand-darkTeal">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-brand-coral bg-white p-4 text-sm text-brand-darkTeal">{error}</p>}
      {receipt ? <><FundReceipt receipt={receipt} /><Button variant="outline" className="min-h-[48px] w-full" onClick={() => { setReceipt(null); setNotice(null); }}>Make another sandbox contribution</Button></>
        : returnOrder ? <section aria-label="Confirm contribution" className="rounded-2xl border border-brand-sageBorder bg-white p-6">
          <p role="status" aria-live="polite" className="text-sm text-brand-darkTeal">{pending ? "Checking payment with PayPal…" : "Check this payment before you start another contribution."}</p>
          <Button className="mt-4 min-h-[48px] w-full" loading={pending} onClick={() => void capture(returnOrder)}>Check payment again</Button>
        </section> : <form onSubmit={start} aria-label="Sandbox contribution" aria-busy={pending} className="rounded-2xl border border-brand-sageBorder bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-brand-darkTeal">Add a sandbox contribution</h2>
          <label htmlFor="contribution-amount" className="mt-5 block text-sm font-bold text-brand-darkTeal">Amount (PHP)</label>
          <input id="contribution-amount" name="amount" inputMode="decimal" autoComplete="off" required maxLength={9} pattern="[0-9]+\.[0-9]{2}" aria-describedby="amount-help" value={amount} onChange={e => setAmount(e.target.value)} disabled={pending}
            className="mt-2 min-h-[52px] w-full rounded-xl border border-brand-sageBorder bg-white px-4 text-xl font-bold tabular-nums text-brand-darkTeal focus:outline-2 focus:outline-brand-activeTeal" />
          <p id="amount-help" className="mt-2 text-xs text-brand-darkTeal/75">PHP 1.00 to PHP 100,000.00. Use two decimal places.</p>
          <Button type="submit" loading={pending} className="mt-5 min-h-[52px] w-full">{pending ? "Opening PayPal…" : "Continue to PayPal sandbox"}</Button>
          <p className="mt-3 text-xs leading-relaxed text-brand-darkTeal/75">Approve in PayPal, then return here for your receipt. Test funds only. No real money moves.</p>
        </form>}
    </div>
  );
}
