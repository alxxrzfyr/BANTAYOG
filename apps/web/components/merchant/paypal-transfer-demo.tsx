"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { PayPalDemoDetails, maskDemoRecipient } from "@/lib/paypal-transfer-demo";

// Local preview only. This component must not call payment APIs or update account state.
export function PayPalTransferDemo({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [details, setDetails] = useState<PayPalDemoDetails>({ amount: "100.00", recipient: "merchant@example.test" });
  const [step, setStep] = useState<"details" | "preview" | "complete">("details");
  const [error, setError] = useState<string | null>(null);
  const complete = step === "complete";

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    headingRef.current?.focus();
  }, [step]);

  const close = () => dialogRef.current?.close();
  const preparePreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = PayPalDemoDetails.safeParse({ amount: form.get("amount"), recipient: form.get("recipient") });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the demo details and try again.");
      return;
    }
    setError(null);
    setDetails(result.data);
    setStep("preview");
  };

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="paypal-demo-title" aria-describedby="paypal-demo-notice"
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-6 font-body text-brand-darkTeal shadow-xl backdrop:bg-black/50">
      <h2 ref={headingRef} tabIndex={-1} id="paypal-demo-title" className="text-xl font-bold">{complete ? "Demo complete" : "Transfer to Wallet"}</h2>
      <p className="mt-2 text-base font-semibold">PayPal (Demo)</p>
      <p id="paypal-demo-notice" className="mt-3 text-sm leading-relaxed">
        Simulation only. No funds move. This does not contact PayPal or change your balance or claims.
      </p>

      {step === "details" ? (
        <form onSubmit={preparePreview} autoComplete="off" className="mt-6 space-y-4">
          <Input label="Demo amount (PHP)" name="amount" type="text" inputMode="decimal" required maxLength={12} defaultValue={details.amount} />
          <Input label="Example PayPal email" name="recipient" type="email" required maxLength={254}
            autoComplete="off" defaultValue={details.recipient} />
          <p className="text-xs leading-relaxed">Use example details. They stay in this preview and are cleared when you close it.</p>
          {error && <p role="alert" className="text-sm font-semibold text-brand-darkTeal">{error}</p>}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" size="lg" className="w-full">Preview demo transfer</Button>
            <Button type="button" size="lg" variant="outline" onClick={close} className="w-full">Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <dl className="space-y-4 border-y border-brand-sageBorder py-4">
            <div><dt className="text-sm">Demo amount</dt><dd className="mt-1 text-2xl font-bold tabular-nums">PHP {details.amount}</dd></div>
            <div><dt className="text-sm">Example destination</dt><dd className="mt-1 break-all text-base font-semibold">{maskDemoRecipient(details.recipient)}</dd></div>
          </dl>
          {complete ? (
            <>
              <p role="status" className="text-base font-semibold">Simulation complete—no funds moved.</p>
              <p className="text-sm leading-relaxed">Your balance and claim statuses are unchanged. No PayPal transaction was created.</p>
              <Button type="button" size="lg" onClick={close} className="w-full">Done</Button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <Button type="button" size="lg" onClick={() => setStep("complete")} className="w-full">Confirm simulation</Button>
              <Button type="button" size="lg" variant="outline" onClick={() => setStep("details")} className="w-full">Edit example details</Button>
              <Button type="button" size="lg" variant="ghost" onClick={close} className="w-full">Cancel</Button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
