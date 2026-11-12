import { describe, expect, it } from "vitest";
import { safePayUrl } from "./pay-url";

describe("safePayUrl", () => {
  it("accepts an https PayPal sandbox invoice link", () => {
    const url = "https://www.sandbox.paypal.com/invoice/p/#INV2-XXXX";
    expect(safePayUrl(url)).toBe(url);
  });

  it.each([
    "https://paypal.com/invoice/p/#A",
    "https://www.paypal.com/invoice/p/#A",
    "https://developer.paypal.com/invoice/p/#A",
    "https://user:password@www.sandbox.paypal.com/invoice/p/#A",
    "https://www.sandbox.paypal.com:444/invoice/p/#A",
  ])("rejects a non-sandbox or credential-bearing URL: %s", (url) => {
    expect(safePayUrl(url)).toBeNull();
  });

  it("rejects http", () => {
    expect(safePayUrl("http://www.sandbox.paypal.com/invoice/p/#A")).toBeNull();
  });

  it("rejects javascript: and data: links", () => {
    expect(safePayUrl("javascript:alert(1)")).toBeNull();
    expect(safePayUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects look-alike hosts", () => {
    expect(safePayUrl("https://paypal.com.evil.test/invoice")).toBeNull();
    expect(safePayUrl("https://evilpaypal.com/invoice")).toBeNull();
    expect(safePayUrl("https://paypal.com@evil.test/invoice")).toBeNull();
  });

  it("rejects a malformed string, an empty string and null", () => {
    expect(safePayUrl("not a url")).toBeNull();
    expect(safePayUrl("")).toBeNull();
    expect(safePayUrl(null)).toBeNull();
    expect(safePayUrl(undefined)).toBeNull();
  });
});
