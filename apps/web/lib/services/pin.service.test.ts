import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "./pin.service";

describe("pin.service", () => {
  it("hashes a 6-digit PIN and returns a non-empty string", async () => {
    const hash = await hashPin("123456");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct PIN", async () => {
    const hash = await hashPin("654321");
    const valid = await verifyPin("654321", hash);
    expect(valid).toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const hash = await hashPin("111111");
    const valid = await verifyPin("222222", hash);
    expect(valid).toBe(false);
  });

  it("rejects verification against a tampered hash", async () => {
    const valid = await verifyPin("123456", "invalidhash$argon2id");
    expect(valid).toBe(false);
  });
});
