// API responses and authenticated data must never come from the offline cache.
export function requiresNetwork(url: URL, headers: Headers): boolean {
  return url.pathname === "/api" || url.pathname.startsWith("/api/") || headers.has("Authorization");
}
