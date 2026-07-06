"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";

/**
 * Shape returned by GET /api/merchants/me
 */
export interface MerchantProfile {
  id: string;
  storeName: string;
  ownerName: string;
  walletAddress: string | null;
  walletBalance: number;
  connected: boolean;
  status: string;
}

/**
 * Fetches the authenticated merchant's profile with a 10-second timeout.
 * Uses AbortController so the request is cancelled and surfaces as an error
 * if the server does not respond within 10 seconds (Req 7.5, 17.4).
 */
async function fetchMerchantProfile(): Promise<MerchantProfile> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await authFetch("/api/merchants/me", {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch merchant profile (status ${res.status})`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * React Query hook that exposes the authenticated merchant's profile.
 *
 * Validates: Requirements 7.4, 7.5, 8.5, 17.3, 17.4
 */
export function useMerchantProfile() {
  const { data, isLoading, isError, refetch } = useQuery<MerchantProfile>({
    queryKey: ["merchant-profile"],
    queryFn: fetchMerchantProfile,
  });

  return { data, isLoading, isError, refetch };
}
