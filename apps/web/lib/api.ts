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
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch (err) {
    console.error("Error retrieving Supabase session:", err);
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
