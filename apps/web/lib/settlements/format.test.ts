import { describe, expect, it } from "vitest";
import { formatPhp, formatSaleTime, shortHash, shortId } from "./format";

describe("formatPhp", () => {
  it("groups the integer part of the API string and keeps the decimals as given", () => {
    expect(formatPhp("1234567.50")).toBe("₱1,234,567.50");
    expect(formatPhp("0.00")).toBe("₱0.00");
    expect(formatPhp("999.99")).toBe("₱999.99");
    expect(formatPhp("1000.00")).toBe("₱1,000.00");
  });

  it("does not round or recompute: extra decimals stay exactly as the API sent them", () => {
    expect(formatPhp("0.105")).toBe("₱0.105");
    expect(formatPhp("12345678901234567890.10")).toBe("₱12,345,678,901,234,567,890.10");
  });

  it("returns an unexpected value unchanged with the currency sign", () => {
    expect(formatPhp("abc")).toBe("₱abc");
  });
});

describe("formatSaleTime", () => {
  it("shows Manila local date and time", () => {
    expect(formatSaleTime("2026-11-12T06:04:00.000Z")).toBe("Nov 12, 2026, 2:04 PM");
  });

  it("returns the raw value for an invalid date", () => {
    expect(formatSaleTime("not-a-date")).toBe("not-a-date");
  });
});

describe("shortId and shortHash", () => {
  it("shortId keeps the first 8 characters", () => {
    expect(shortId("a1b2c3d4-e5f6-7890-abcd-ef0123456789")).toBe("a1b2c3d4");
  });

  it("shortHash keeps both ends of a long hash", () => {
    expect(shortHash("0123456789abcdef0123456789abcdef")).toBe("012345…abcdef");
    expect(shortHash("short")).toBe("short");
  });
});
