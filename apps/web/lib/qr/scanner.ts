/**
 * QR Scanner
 *
 * Browser-side QR scanner using @zxing/browser.
 * Accesses the device camera via getUserMedia — must be client-only.
 *
 * FE2 ownership — @bantayog/web
 */

"use client";

import { BrowserQRCodeReader } from "@zxing/browser";

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
  private codeReader: BrowserQRCodeReader | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isScanning = false;

  /**
   * Start scanning from the given video element.
   * Calls onResult each time a QR code is detected.
   */
  async start(
    videoElement: HTMLVideoElement,
    onResult: ScanCallback,
    onError?: ScanErrorCallback,
  ): Promise<void> {
    if (this.isScanning) {
      return;
    }

    this.videoElement = videoElement;
    this.codeReader = new BrowserQRCodeReader();

    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      // Attach stream to video element
      videoElement.srcObject = this.stream;
      await videoElement.play();

      this.isScanning = true;

      // Start continuous scanning
      this.codeReader.decodeFromVideoElement(
        videoElement,
        (result, error) => {
          if (result) {
            onResult({
              text: result.getText(),
              format: result.getBarcodeFormat()?.toString() || "QR_CODE",
            });
          }
          // Only report errors that aren't decode-related (decode errors are expected when no QR is in view)
          if (error && error.constructor?.name !== "ChecksumException" && error.constructor?.name !== "FormatException") {
            onError?.(error as Error);
          }
        },
      );
    } catch (err) {
      this.isScanning = false;
      const error =
        err instanceof Error ? err : new Error("Failed to start QR scanner");
      onError?.(error);
      throw error;
    }
  }

  /** Stop scanning and release the camera stream. */
  stop(): void {
    this.isScanning = false;

    // Stop the code reader
    if (this.codeReader) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reader = this.codeReader as any;
      if (typeof reader.reset === "function") {
        reader.reset();
      }
      this.codeReader = null;
    }

    // Stop all camera tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Clear video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /** Check if the scanner is currently active */
  get scanning(): boolean {
    return this.isScanning;
  }
}
