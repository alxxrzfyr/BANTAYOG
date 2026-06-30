/**
 * QR Scanner
 *
 * Browser-side QR scanner using @zxing/browser.
 * Accesses the device camera via getUserMedia — must be client-only.
 *
 * FE2 ownership — @bantayog/web
 */

"use client";

export interface ScanResult {
  /** Decoded text content of the QR code */
  text: string;
  /** QR code format (e.g. "QR_CODE", "DATA_MATRIX") */
  format: string;
}

export type ScanCallback = (result: ScanResult) => void;
export type ScanErrorCallback = (error: Error) => void;

/**
 * Manages camera-based QR scanning lifecycle.
 * Attach to a <video> element, listen for results, stop when done.
 */
export class QRScanner {
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Start scanning from the given video element.
   * Calls onResult each time a QR code is detected.
   */
  async start(
    _videoElement: HTMLVideoElement,
    _onResult: ScanCallback,
    _onError?: ScanErrorCallback,
  ): Promise<void> {
    // TODO: implement with @zxing/browser BrowserQRCodeReader
    throw new Error("Not implemented — T-1.9 placeholder");
  }

  /** Stop scanning and release the camera stream. */
  stop(): void {
    if (this.videoElement?.srcObject) {
      const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  }
}
