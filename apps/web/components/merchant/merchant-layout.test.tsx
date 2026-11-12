import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MerchantProfile } from "@/hooks/use-merchant-profile";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard/settlements",
  push: vi.fn(),
  authFetch: vi.fn(),
  effects: [] as Array<() => void>,
  profileQuery: {
    data: undefined as MerchantProfile | undefined,
    error: null as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  fetchProfile: null as null | (() => Promise<MerchantProfile>),
  overview: {
    unpaidSaleCount: 0, unpaidAmountPhp: "0.00", waitingForLedgerCount: 0,
    paidAmountPhp: "0.00", invoices: [],
  },
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  // The existing Node renderer does not run effects. Flush them after rendering.
  useEffect: (effect: () => void) => { mocks.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api", () => ({
  MERCHANT_TOKEN_KEY: "bantayog_merchant_access_token",
  authFetch: mocks.authFetch,
}));
vi.mock("@/providers/pin-lock-provider", () => ({
  PinLockProvider: ({ children }: { children: React.ReactNode }) => <div data-pin-lock>{children}</div>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: string[]; queryFn: () => Promise<MerchantProfile> }) => {
    if (options.queryKey[0] === "merchant-profile") {
      mocks.fetchProfile = options.queryFn;
      return mocks.profileQuery;
    }
    return {
      data: options.queryKey[0] === "merchant-settlements" ? mocks.overview : undefined,
      dataUpdatedAt: 0, isLoading: false, refetch: vi.fn(),
    };
  },
  useQueryClient: () => ({}),
  useMutation: () => ({ isPending: false, reset: vi.fn() }),
}));

import MerchantLayout from "@/app/(merchant)/layout";
import MerchantSettlementsPage from "@/app/(merchant)/dashboard/settlements/page";
import { MERCHANT_TOKEN_KEY } from "@/lib/api";

let storage: Map<string, string>;
let removeItem: ReturnType<typeof vi.fn>;

function render() {
  const html = renderToStaticMarkup(
    <MerchantLayout><MerchantSettlementsPage /></MerchantLayout>,
  );
  for (const effect of mocks.effects.splice(0)) effect();
  return html;
}

async function loadProfile() {
  render();
  try {
    mocks.profileQuery.data = await mocks.fetchProfile!();
  } catch (error) {
    mocks.profileQuery.error = error;
    mocks.profileQuery.isError = true;
  }
  return render();
}

function expectSessionRetained() {
  expect(storage.get(MERCHANT_TOKEN_KEY)).toBe("valid-token");
  expect(storage.get(MERCHANT_TOKEN_KEY + "_expires")).toBe("9999999999");
  expect(removeItem).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/dashboard/settlements";
  mocks.effects = [];
  mocks.profileQuery.data = undefined;
  mocks.profileQuery.error = null;
  mocks.profileQuery.isError = false;
  storage = new Map([[MERCHANT_TOKEN_KEY, "valid-token"], [MERCHANT_TOKEN_KEY + "_expires", "9999999999"]]);
  removeItem = vi.fn((key: string) => storage.delete(key));
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, removeItem } });
});

afterEach(() => vi.unstubAllGlobals());

describe("merchant profile failures in the merchant layout", () => {
  it.each([401, 403])("clears access and expiry and redirects for HTTP %s even with a malformed body", async (status) => {
    mocks.authFetch.mockResolvedValue(new Response("not JSON", { status }));
    await loadProfile();
    expect(storage.has(MERCHANT_TOKEN_KEY)).toBe(false);
    expect(storage.has(MERCHANT_TOKEN_KEY + "_expires")).toBe(false);
    expect(mocks.push).toHaveBeenCalledWith("/merchant-login");
  });

  it.each([502, 503])("keeps the session and independent settlements usable for HTTP %s", async (status) => {
    mocks.authFetch.mockResolvedValue(new Response("provider unavailable", { status }));
    const html = await loadProfile();
    expect(mocks.profileQuery.isError).toBe(true);
    expectSessionRetained();
    expect(html).toContain("Nothing to claim yet");
    expect(html).toContain("data-pin-lock");
  });

  it.each([
    ["network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["timeout", () => Promise.reject(new DOMException("Aborted", "AbortError"))],
    ["malformed JSON", () => Promise.resolve(new Response("not JSON", { status: 200 }))],
  ])("retains the session after %s", async (_label, response) => {
    mocks.authFetch.mockImplementation(response);
    await loadProfile();
    expect(mocks.profileQuery.isError).toBe(true);
    expectSessionRetained();
  });

  it.each(["ACTIVE", "SUSPENDED"])("keeps existing %s merchant behavior", async (status) => {
    const profile: MerchantProfile = {
      id: "merchant", storeName: "Store", ownerName: "Owner", walletAddress: null,
      walletBalance: 12, connected: false, status,
    };
    mocks.authFetch.mockResolvedValue(Response.json(profile));
    await loadProfile();
    expect(mocks.profileQuery.data).toEqual(profile);
    if (status === "SUSPENDED") {
      expect(storage.has(MERCHANT_TOKEN_KEY)).toBe(false);
      expect(storage.has(MERCHANT_TOKEN_KEY + "_expires")).toBe(false);
      expect(mocks.push).toHaveBeenCalledWith("/merchant-login");
    } else {
      expectSessionRetained();
    }
  });

  it("does not redirect the login page after a cached profile error", async () => {
    mocks.pathname = "/merchant-login";
    mocks.authFetch.mockResolvedValue(new Response(null, { status: 401 }));
    await loadProfile();
    expectSessionRetained();
  });
});
