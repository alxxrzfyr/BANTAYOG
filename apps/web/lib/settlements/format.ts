// Display formatting for settlement screens. String operations only: the web app never
// converts a money value to a number, so it cannot round or recompute an amount.

const PLAIN_DECIMAL = /^(\d+)(\.\d+)?$/;

/** "1234.50" -> "₱1,234.50". Groups the integer part; keeps the decimals as given. */
export function formatPhp(amount: string): string {
  const match = PLAIN_DECIMAL.exec(amount);
  if (!match) return `₱${amount}`;
  const grouped = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₱${grouped}${match[2] ?? ""}`;
}

const SALE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Manila local time, for example "Nov 12, 2026, 2:04 PM". */
export function formatSaleTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return SALE_TIME.format(date);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

/** Stellar testnet explorer link for a ledger transaction hash. */
export function ledgerExplorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`;
}
