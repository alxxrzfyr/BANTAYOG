import Link from "next/link";
import type { FundLedgerDto } from "@bantayog/schema";
import { formatPhp, formatSaleTime } from "@/lib/settlements/format";

export function FundLedgerView({ ledger }: { ledger: FundLedgerDto }) {
  const cards = [
    ["Gross contributions", ledger.grossContributionsPhp], ["PayPal fees", ledger.feesPhp],
    ["Net contributions", ledger.netContributionsPhp], ["Grants issued on the ledger", ledger.grantsIssuedPhp],
  ];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-brand-darkTeal">Program fund</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-darkTeal/80">Sandbox funding and nutrition sales. Contributions do not yet issue child credits or pay store invoices.</p></div>
      <Link href="/fund" className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-activeTeal px-4 text-sm font-bold text-brand-activeTeal">Open funder checkout</Link>
    </header>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, amount]) => <div key={label} className="rounded-2xl border border-brand-sageBorder/50 bg-white p-5 shadow-sm"><dt className="text-xs font-semibold text-brand-darkTeal/80">{label}</dt><dd className="mt-2 break-words text-2xl font-bold tabular-nums text-brand-darkTeal">{formatPhp(amount)}</dd></div>)}</dl>
    <section aria-labelledby="owed-heading" className="rounded-2xl bg-brand-darkTeal p-6 text-white">
      <h2 id="owed-heading" className="text-sm font-bold">Amount still owed for confirmed food sales</h2>
      <p className="mt-2 text-3xl font-bold tabular-nums">{formatPhp(ledger.owedPhp)}</p>
      <p className="mt-3 text-sm leading-relaxed">{formatPhp(ledger.confirmedSalesPhp)} confirmed sales − {formatPhp(ledger.paidInvoicesPhp)} paid invoices = {formatPhp(ledger.owedPhp)} still owed.</p>
      <p className="mt-3 text-xs leading-relaxed">Paid invoice totals are gross amounts. PayPal can deduct a fee from the receiving account. This is not a cash balance. {ledger.grantCount} grants have a recorded ledger transaction.</p>
    </section>
    <section aria-labelledby="topups-heading" className="overflow-hidden rounded-2xl border border-brand-sageBorder/50 bg-white shadow-sm">
      <h2 id="topups-heading" className="px-5 py-4 text-sm font-bold text-brand-darkTeal">Recent completed contributions</h2>
      {ledger.topups.length === 0 ? <p className="px-5 pb-6 text-sm text-brand-darkTeal/75">No contribution has completed yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-brand-darkTeal"><caption className="sr-only">Latest 50 completed sandbox contributions, with separate fees and net amounts</caption><thead className="bg-brand-peachBg/40 text-xs"><tr>{["Completed", "Capture", "Gross", "Fee", "Net"].map(name => <th key={name} scope="col" className="whitespace-nowrap px-5 py-3">{name}</th>)}</tr></thead><tbody>{ledger.topups.map(t => <tr key={t.id} className="border-t border-brand-sageBorder/30"><td className="whitespace-nowrap px-5 py-4">{t.completedAt ? formatSaleTime(t.completedAt) : "Not recorded"}</td><td className="px-5 py-4 font-mono text-xs">{t.captureId}</td><td className="whitespace-nowrap px-5 py-4 tabular-nums">{formatPhp(t.amountPhp)}</td><td className="whitespace-nowrap px-5 py-4 tabular-nums">{t.feePhp === null ? "Not reported" : formatPhp(t.feePhp)}</td><td className="whitespace-nowrap px-5 py-4 font-bold tabular-nums">{t.netAmountPhp === null ? "Not reported" : formatPhp(t.netAmountPhp)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
