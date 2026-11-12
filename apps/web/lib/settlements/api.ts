// Typed client for the PayPal settlement endpoints (docs/designs/paypal-settlement.md §6).
// FE owns this file. Calls go through authFetch, which picks the merchant token or the
// admin session. No money logic here: the server decides totals, eligibility and status.

import { authFetch } from "@/lib/api";
import type {
  MerchantSettlementOverviewDto,
  SettlementInvoiceDto,
  SettlementStatus,
} from "./types";

export class SettlementApiError extends Error {
  /** HTTP status, or 0 when no response arrived */
  readonly status: number;
  /** `error` tag from the API error contract, if the body had one */
  readonly tag: string | null;

  constructor(status: number, tag: string | null, message: string) {
    super(message);
    this.name = "SettlementApiError";
    this.status = status;
    this.tag = tag;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(url, init);
  } catch {
    throw new SettlementApiError(0, null, "No connection to the server. Check the internet connection and try again.");
  }

  if (res.ok) return (await res.json()) as T;

  let tag: string | null = null;
  let message = `The server could not complete the request (HTTP ${res.status}).`;
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") tag = body.error;
    if (typeof body.message === "string" && body.message) message = body.message;
  } catch {
    // Not a JSON body: keep the fallback message.
  }
  throw new SettlementApiError(res.status, tag, message);
}

function postJson<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

const id = encodeURIComponent;

/* ── Merchant (the merchant comes from the token) ── */

export function getMerchantSettlementOverview(): Promise<MerchantSettlementOverviewDto> {
  return request("/api/merchants/me/settlements");
}

/** 201 with a new proposal, or 200 with the open invoice. */
export function requestMerchantSettlement(): Promise<SettlementInvoiceDto> {
  return postJson("/api/merchants/me/settlements");
}

export function getMerchantSettlement(invoiceId: string): Promise<SettlementInvoiceDto> {
  return request(`/api/merchants/me/settlements/${id(invoiceId)}`);
}

export function refreshMerchantSettlement(invoiceId: string): Promise<SettlementInvoiceDto> {
  return postJson(`/api/merchants/me/settlements/${id(invoiceId)}/refresh`);
}

/* ── Admin (program officer) ── */

export function listSettlements(status?: SettlementStatus): Promise<SettlementInvoiceDto[]> {
  return request(status ? `/api/settlements?status=${status}` : "/api/settlements");
}

export function getSettlement(invoiceId: string): Promise<SettlementInvoiceDto> {
  return request(`/api/settlements/${id(invoiceId)}`);
}

export function approveSettlement(invoiceId: string, releaseTransactionIds: string[]): Promise<SettlementInvoiceDto> {
  return postJson(
    `/api/settlements/${id(invoiceId)}/approve`,
    releaseTransactionIds.length > 0 ? { releaseTransactionIds } : {},
  );
}

export function rejectSettlement(invoiceId: string, reason: string): Promise<SettlementInvoiceDto> {
  return postJson(`/api/settlements/${id(invoiceId)}/reject`, { reason });
}

export function refreshSettlement(invoiceId: string): Promise<SettlementInvoiceDto> {
  return postJson(`/api/settlements/${id(invoiceId)}/refresh`);
}
