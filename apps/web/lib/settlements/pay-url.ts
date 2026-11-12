export function safePayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === "https://www.sandbox.paypal.com" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
