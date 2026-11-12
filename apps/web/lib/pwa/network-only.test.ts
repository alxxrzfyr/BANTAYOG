import { describe, expect, it } from "vitest";
import { requiresNetwork } from "./network-only";

describe("PWA private response policy", () => {
  it.each(["/api/fund/ledger", "/api/merchants/me/settlements", "/api/balance?token=printed-pass"])("never caches %s", path => {
    expect(requiresNetwork(new URL(path, "https://bantayog.example"), new Headers())).toBe(true);
  });
  it("never caches an authenticated cross-origin request", () => {
    expect(requiresNetwork(new URL("https://project.supabase.co/auth/v1/user"), new Headers({ Authorization: "Bearer test-session" }))).toBe(true);
  });
  it("keeps public static assets eligible for the existing cache rules", () => {
    expect(requiresNetwork(new URL("https://bantayog.example/logo.png"), new Headers())).toBe(false);
    expect(requiresNetwork(new URL("https://bantayog.example/apiary.png"), new Headers())).toBe(false);
  });
});
