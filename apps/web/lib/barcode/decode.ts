import { BrowserMultiFormatReader } from "@zxing/browser";

let zxingReader: BrowserMultiFormatReader | null = null;

// @zxing/library (the hint/format types) isn't a direct dependency, only a
// transitive peer of @zxing/browser, so we can't import it to restrict
// formats here — the default reader tries all zxing formats instead.
function getZxingReader(): BrowserMultiFormatReader {
  if (!zxingReader) {
    zxingReader = new BrowserMultiFormatReader();
  }
  return zxingReader;
}

/**
 * Decodes a 1D product barcode (EAN-13/EAN-8/UPC-A/UPC-E) from a canvas frame.
 * Prefers the native BarcodeDetector API; falls back to @zxing/browser on
 * browsers that don't implement it (iOS Safari). Returns null on any failure
 * so callers can silently fall through to the Gemini vision path.
 */
export async function decodeProductBarcode(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  try {
    if ("BarcodeDetector" in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      const results = await detector.detect(canvas);
      return results[0]?.rawValue ?? null;
    }

    const result = getZxingReader().decodeFromCanvas(canvas);
    return result.getText();
  } catch {
    return null;
  }
}
