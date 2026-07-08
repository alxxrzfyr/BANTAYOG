const PIN_HASH_KEY = "bantayog_merchant_pin_hash";
const PIN_LOCKED_KEY = "bantayog_pin_locked";

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export function storePinHash(hash: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PIN_HASH_KEY, hash);
  }
}

export function getPinHash(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(PIN_HASH_KEY);
  }
  return null;
}

export function clearPinHash(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PIN_HASH_KEY);
    window.localStorage.removeItem(PIN_LOCKED_KEY);
  }
}

export function hasPin(): boolean {
  return getPinHash() !== null;
}

export function setPinLocked(locked: boolean): void {
  if (typeof window !== "undefined") {
    if (locked) {
      window.localStorage.setItem(PIN_LOCKED_KEY, "true");
    } else {
      window.localStorage.removeItem(PIN_LOCKED_KEY);
    }
  }
}

export function isPinLocked(): boolean {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(PIN_LOCKED_KEY) === "true";
  }
  return false;
}
