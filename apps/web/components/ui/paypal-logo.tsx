// FE owns this file. Requirements: PayPal fund and settlement screens.
// Official PayPal logo file, not changed. Show it only where PayPal does the step.
// It is decorative: the text next to it always names PayPal.
export function PayPalLogo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  const logo = <img src="/paypal-logo.svg" alt="" width={71} height={20} className="h-5 w-auto" />;
  // The logo colours need a white surface. On a dark surface, give it a white plate.
  return onDark
    ? <span aria-hidden="true" className={`inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 ${className}`}>{logo}</span>
    : <span aria-hidden="true" className={`inline-flex flex-shrink-0 items-center ${className}`}>{logo}</span>;
}
