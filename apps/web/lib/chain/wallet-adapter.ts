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

  return { method: "injected", address, proof };
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
 * Sends the address and proof to BE2-3.7's wallet adapter gateway.
 */
export async function verifyWalletConnection(
  connection: WalletConnection,
): Promise<{ verified: boolean; merchantId?: string }> {
  // TODO: Replace with real API call to backend wallet adapter gateway
  // const res = await fetch("/api/auth/verify-wallet", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(connection),
  // });
  // return res.json();

  // Mock verification for now
  return { verified: true, merchantId: "MERCH-001" };
}
