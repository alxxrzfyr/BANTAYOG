import { describe, expect, it } from "vitest";
import { PayPalDemoDetails, maskDemoRecipient } from "./paypal-transfer-demo";

describe("PayPal transfer demo details", () => {
  it("keeps the preview amount as text and masks the recipient", () => {
    const result = PayPalDemoDetails.parse({ amount: "125.50", recipient: "merchant@example.test" });
    expect(result.amount).toBe("125.50");
    expect(maskDemoRecipient(result.recipient)).toBe("m***@example.test");
  });

  it.each(["0", "0.00", "-5", "NaN", "Infinity", "1e2", "10.001", "", "1000000000"])("rejects invalid demo amount %s", (amount) => {
    expect(PayPalDemoDetails.safeParse({ amount, recipient: "merchant@example.test" }).success).toBe(false);
  });

  it.each(["", "not-an-email", "merchant@"])("requires a valid example recipient: %s", (recipient) => {
    expect(PayPalDemoDetails.safeParse({ amount: "0.01", recipient }).success).toBe(false);
  });
});
