import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PayPalTransferDemo } from "./paypal-transfer-demo";

describe("PayPalTransferDemo", () => {
  it("shows a labeled simulation with example details and a preview before confirmation", () => {
    const html = renderToStaticMarkup(<PayPalTransferDemo onClose={() => {}} />);
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-labelledby="paypal-demo-title"');
    expect(html).toContain("PayPal (Demo)");
    expect(html).toContain("Simulation only. No funds move.");
    expect(html).toContain("does not contact PayPal or change your balance or claims");
    expect(html).toContain('value="100.00"');
    expect(html).toContain('value="merchant@example.test"');
    expect(html).toContain("Preview demo transfer");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("Confirm simulation");
    expect(html).not.toContain("Simulation complete");
  });
});
