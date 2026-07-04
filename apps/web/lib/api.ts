import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * A wrapper around the native fetch API that automatically retrieves the
 * current Supabase auth session token and attaches it to the request's
 * Authorization header as a Bearer token.
 */
/** localStorage key holding the merchant access token (set on merchant login). */
export const MERCHANT_TOKEN_KEY = "bantayog_merchant_access_token";

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch (err) {
    console.error("Error retrieving Supabase session:", err);
  }

  // Fall back to a stored merchant token. The merchant login endpoint returns
  // a Supabase access token that isn't persisted in the browser Supabase
  // client (no refresh token is returned), so it's stashed in localStorage
  // and used here for merchant-authenticated calls (e.g. POST /api/transactions).
  if (!token && typeof window !== "undefined") {
    token = window.localStorage.getItem(MERCHANT_TOKEN_KEY);
  }

  const headers = {
    ...options.headers,
  } as Record<string, string>;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
