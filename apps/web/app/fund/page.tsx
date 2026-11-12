import { FunderCheckout } from "@/components/fund/funder-checkout";

export default function FundPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-canvas-secondary)] px-5 py-10 font-body text-brand-darkTeal sm:py-16">
      <div className="mx-auto max-w-xl">
        <img src="/merchantLogos/darkTitle.png" alt="BANTAYOG" width={200} height={48} className="mb-8 h-auto w-44" />
        <p className="text-xs font-bold uppercase tracking-widest text-brand-activeTeal">PayPal sandbox</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Help nutrition aid reach the food counter.</h1>
        <p className="mt-4 text-base leading-relaxed">BANTAYOG checks food purchases at approved stores and records the invoices paid through PayPal.</p>
        <p className="mb-7 mt-3 text-sm leading-relaxed text-brand-darkTeal/80">Try a sandbox contribution. This prototype records funding separately from child credits and store payments. It does not yet assign your contribution to a child or pay a store from that contribution.</p>
        <FunderCheckout />
      </div>
    </main>
  );
}
