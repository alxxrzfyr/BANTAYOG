/**
 * Wallet Adapter — Frontend Decision Tree
 *
 * Supports three connection methods:
 * 1. Injected EIP-1193 (Ronin Wallet, MetaMask)
 * 2. Tanto Connect (mobile deep-link via @sky-mavis/tanto-connect)
 * 3. Sky Mavis Waypoint (OAuth redirect via @sky-mavis/waypoint)
 *
 * FE2-3.11 — @bantayog/web
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletMethod = "injected" | "tanto" | "waypoint";

export interface WalletConnection {
  method: WalletMethod;
  address: string;
  proof: string;
  message?: string;
}

export interface WalletProvider {
  isMetaMask?: boolean;
  isRonin?: boolean;
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Environment Detection
// ---------------------------------------------------------------------------

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getInjectedProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;

  // Check for Ronin Wallet
  const ronin = (window as Record<string, unknown>).ethereum as WalletProvider | undefined;
  if (ronin?.isRonin) return ronin;

  // Check for MetaMask or any EIP-1193 provider
  const ethereum = (window as Record<string, unknown>).ethereum as WalletProvider | undefined;
  if (ethereum) return ethereum;

  return null;
}

// ---------------------------------------------------------------------------
// Connection Methods (Placeholder implementations)
// ---------------------------------------------------------------------------

/**
 * Connect via injected EIP-1193 provider (Ronin Wallet, MetaMask).
 * Requests account access and signs a message for proof of ownership.
 */
async function connectInjected(): Promise<WalletConnection> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No injected wallet provider found");
  }

  // Request accounts
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned by wallet");
  }

  const address = accounts[0];

  // Sign a message for proof of ownership
  const message = `BANTAYOG Wallet Verification\nAddress: ${address}\nTimestamp: ${Date.now()}`;
  const proof = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  return { method: "injected", address, proof, message };
}

/**
 * Connect via Sky Mavis Tanto Connect (mobile deep-link).
 * TODO: Implement with @sky-mavis/tanto-connect when package is installed.
 */
async function connectTanto(): Promise<WalletConnection> {
  // TODO: Replace with actual Tanto Connect implementation
  // import { TantoConnect } from "@sky-mavis/tanto-connect";
  // const connector = new TantoConnect();
  // const result = await connector.connect();
  // return { method: "tanto", address: result.address, proof: result.signature };

  throw new Error(
    "Tanto Connect not yet implemented — install @sky-mavis/tanto-connect",
  );
}

/**
 * Connect via Sky Mavis Waypoint (OAuth redirect).
 * TODO: Implement with @sky-mavis/waypoint when package is installed.
 */
async function connectWaypoint(): Promise<WalletConnection> {
  // TODO: Replace with actual Waypoint implementation
  // import { Waypoint } from "@sky-mavis/waypoint";
  // const waypoint = new Waypoint({ clientId: process.env.NEXT_PUBLIC_SKYMAVIS_CLIENT_ID });
  // const result = await waypoint.connect();
  // return { method: "waypoint", address: result.address, proof: result.signature };

  throw new Error(
    "Waypoint not yet implemented — install @sky-mavis/waypoint",
  );
}

// ---------------------------------------------------------------------------
// Backend Verification Stub (BE2-3.7)
// ---------------------------------------------------------------------------

export interface BackendVerificationResult {
  verified: boolean;
  error?: string;
}

/**
 * Verify a wallet connection with the backend (BE2-3.7 wallet adapter gateway).
 *
 * TODO(BE2-3.7): replace with real endpoint once the backend wallet adapter
 * gateway is implemented. The function signature and return type are the
 * frontend-side contract — Backend 2 only needs to fill in the fetch URL
 * and handle the response shape.
 *
 * @param address - The wallet address to verify (e.g. "ronin:...")
 * @param proof   - Signed proof of ownership from personal_sign
 * @returns       - { verified: true } on success, { verified: false, error: "..." } on failure
 */
export async function verifyWalletWithBackend(
  address: string,
  proof: string,
): Promise<BackendVerificationResult> {
  // TODO(BE2-3.7): replace with real endpoint once BE2-3.7 is implemented
  // const res = await fetch("/api/auth/verify-wallet", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ address, proof }),
  // });
  // if (!res.ok) return { verified: false, error: `Verification failed (${res.status})` };
  // const data = await res.json();
  // return { verified: data.verified, error: data.error };

  // Placeholder: simulate backend verification
  await new Promise((r) => setTimeout(r, 800));
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Decision Tree
// ---------------------------------------------------------------------------

/**
 * Pick the best wallet connection method based on environment.
 *
 * Priority:
 * 1. Injected EIP-1193 (if available — covers desktop extensions)
 * 2. Tanto Connect (if on mobile and no injected provider)
 * 3. Sky Mavis Waypoint (universal fallback — OAuth redirect)
 *
 * Returns the connection details or throws if all methods fail.
 */
export async function pickWallet(): Promise<WalletConnection> {
  // 1. Check for injected provider first
  if (getInjectedProvider()) {
    try {
      return await connectInjected();
    } catch {
      // Fall through to next method
    }
  }

  // 2. If on mobile, try Tanto Connect
  if (isMobile()) {
    try {
      return await connectTanto();
    } catch {
      // Fall through to Waypoint
    }
  }

  // 3. Universal fallback: Sky Mavis Waypoint
  return await connectWaypoint();
}

/**
 * Get available wallet methods for the current environment.
 * Used to render connection options in the UI.
 */
export function getAvailableMethods(): WalletMethod[] {
  const methods: WalletMethod[] = [];

  if (getInjectedProvider()) {
    methods.push("injected");
  }

  if (isMobile()) {
    methods.push("tanto");
  }

  // Waypoint is always available as a fallback
  methods.push("waypoint");

  return methods;
}

/**
 * Verify wallet connection with the backend.
 * Sends the address and proof to BE2-3.7's wallet adapter gateway (/api/auth/wallet-login).
 */
export async function verifyWalletConnection(
  connection: WalletConnection,
): Promise<{ verified: boolean; session?: { accessToken: string; expiresAt: string }; user?: any; error?: string }> {
  // Try to use window location origin or relative path, or fall back to configured backend url
  const apiBaseUrl = typeof window !== "undefined"
    ? (window.location.origin.includes("localhost") ? "http://localhost:3001" : "")
    : (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001")

  try {
    const res = await fetch(`${apiBaseUrl}/api/auth/wallet-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: connection.method,
        proof: {
          address: connection.address,
          message: connection.message,
          signature: connection.method !== "waypoint" ? connection.proof : undefined,
          token: connection.method === "waypoint" ? connection.proof : undefined,
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { verified: false, error: data.message || "Wallet authentication failed" };
    }

    return {
      verified: true,
      session: data.session,
      user: data.user
    };
  } catch (err: any) {
    return { verified: false, error: err.message };
  }
}
