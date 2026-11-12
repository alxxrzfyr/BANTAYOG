// FE owns this file. Requirements: PayPal fund contract. No money decisions here.
import { FundTopupDto, FundLedgerDto, type CreateFundTopupDto } from "@bantayog/schema";
import { authFetch } from "@/lib/api";
import type { z } from "zod";

async function read<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    let message = `The server could not complete the request (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.message === "string") message = body.message;
    } catch { /* Keep the safe fallback for a non-JSON response. */ }
    throw new Error(message);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) throw new Error("The server returned an invalid response. Retry the same contribution.");
  return result.data;
}

async function post(url: string, body: unknown): Promise<FundTopupDto> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  return read(response, FundTopupDto);
}
export function createFundTopup(input: CreateFundTopupDto): Promise<FundTopupDto> {
  return post("/api/fund/topups", input);
}
export function captureFundTopup(orderId: string): Promise<FundTopupDto> {
  return post(`/api/fund/topups/${encodeURIComponent(orderId)}/capture`, {});
}
export async function getFundLedger(): Promise<FundLedgerDto> {
  return read(await authFetch("/api/fund/ledger", { signal: AbortSignal.timeout(45000) }), FundLedgerDto);
}
