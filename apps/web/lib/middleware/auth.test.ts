import { describe, it, expect, vi } from "vitest";
import { requireAdmin, requireAuth, getAuthUser } from "./auth";
import { NextRequest, NextResponse } from "next/server";

// Mock env
vi.mock("@/lib/env", () => ({
  getSupabaseUrl: () => "http://localhost:54321",
  getSupabaseAnonKey: () => "anon-key",
}));

function createRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: new Headers(headers),
  });
}

describe("auth middleware", () => {
  it("getAuthUser returns null without Authorization header", async () => {
    const req = createRequest();
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("getAuthUser returns null with malformed header", async () => {
    const req = createRequest({ authorization: "Basic dXNlcjpwYXNz" });
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("requireAuth returns 401 without header", async () => {
    const req = createRequest();
    const result = await requireAuth(req);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("requireAdmin returns 401 without header", async () => {
    const req = createRequest();
    const result = await requireAdmin(req);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
