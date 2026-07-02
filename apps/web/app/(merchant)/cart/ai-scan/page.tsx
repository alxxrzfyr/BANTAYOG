"use client";

import { Suspense } from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { ProgressIndicator } from "@/components/merchant/progress-indicator";
import { QuantitySelector } from "@/components/merchant/quantity-selector";
import { EligibilityToggle } from "@/components/merchant/eligibility-toggle";
import { CartSummary } from "@/components/merchant/cart-summary";
import { ItemCard } from "@/components/merchant/item-card";

// ---------------------------------------------------------------------------
// AI Image Scan Flow — 3 stages in one page (ref: 16-21.png)
// ---------------------------------------------------------------------------

type Stage = 1 | 2 | 3;

interface DetectionResult {
  name: string;
  eligibility: "eligible" | "ineligible";
}

// Mock response for testing when backend API is unavailable
const MOCK_RESULT: DetectionResult = {
  name: "Fresh Milk",
  eligibility: "eligible",
};

export default function AIScanPage() {
  return (
    <Suspense>
      <AIScanContent />
    </Suspense>
  );
}

function AIScanContent() {
  const searchParams = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);
  const setInputSource = useCartStore((s) => s.setInputSource);

  // ── Stage & form state ──
  const [stage, setStage] = useState<Stage>(
    searchParams.get("resume") === "result" ? 3 : 1,
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [eligibility, setEligibility] = useState<
    "eligible" | "ineligible" | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Camera state ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ── Start camera on mount ──
  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch {
        if (mounted) {
          setCameraError(
            "Camera access denied. Please allow camera access and try again.",
          );
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Capture photo ──
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);

    // Stop camera after capture
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  }, []);

  // ── Validate price ──
  const priceValue = parseFloat(price);
  const isPriceValid = !isNaN(priceValue) && priceValue > 0;
  const isQuantityValid = quantity >= 1;
  const isFormValid = isPriceValid && isQuantityValid;

  // ── Submit to AI (Stage 1 → Stage 2) ──
  const handleContinue = async () => {
    if (!isFormValid || !capturedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Try real API first
      const res = await fetch("/api/vision/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: capturedImage }),
      });

      if (res.ok) {
        const data = await res.json();
        setProductName(data.name || "Unknown Product");
        setEligibility(data.eligibility || "eligible");
      } else {
        // Fall back to mock response
        setProductName(MOCK_RESULT.name);
        setEligibility(MOCK_RESULT.eligibility);
      }
    } catch {
      // API unavailable — use mock response
      setProductName(MOCK_RESULT.name);
      setEligibility(MOCK_RESULT.eligibility);
    } finally {
      setIsProcessing(false);
      setStage(2);
    }
  };

  // ── Add to cart (Stage 2 → Stage 3) ──
  const handleAddToCart = () => {
    if (!productName || !isPriceValid || !eligibility) return;

    addItem({
      name: productName,
      price: priceValue,
      quantity,
      eligibility,
      imageDataUrl: capturedImage || undefined,
    });
    setInputSource("ai");
    setStage(3);
  };

  // ── Reset for next item ──
  const handleAddAnother = () => {
    setStage(1);
    setCapturedImage(null);
    setProductName("");
    setPrice("");
    setQuantity(1);
    setEligibility(null);
    setError(null);
    // Restart camera
    setCameraActive(false);
    setCameraError(null);
  };

  // ── Stage 1 — Capture ──
  if (stage === 1) {
    return (
      <div className="min-h-dvh bg-[#fdf2ed]">
        {/* Header */}
        <header className="flex items-center px-4 pt-5 pb-3">
          <Link
            href="/cart"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            aria-label="Back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#034C52"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center font-title text-[1.35rem] font-black text-[#034C52]">
            AI Image Scan
          </h1>
          <div className="w-9" />
        </header>

        <div className="h-px bg-gray-400" />

        {/* Progress */}
        <ProgressIndicator currentStep={1} />

        <div className="px-5 pb-8">
          {/* Camera Viewfinder */}
          <div className="relative overflow-hidden rounded-2xl border-[3px] border-[#b2dfdb] bg-gray-100">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                  aria-label="Camera viewfinder for capturing product image"
                />
                {/* Corner brackets */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-3 top-3 h-10 w-10 border-l-[3px] border-t-[3px] border-[#80cbc4]" />
                  <div className="absolute right-3 top-3 h-10 w-10 border-r-[3px] border-t-[3px] border-[#80cbc4]" />
                  <div className="absolute bottom-3 left-3 h-10 w-10 border-b-[3px] border-l-[3px] border-[#80cbc4]" />
                  <div className="absolute bottom-3 right-3 h-10 w-10 border-b-[3px] border-r-[3px] border-[#80cbc4]" />
                </div>
                {/* Camera capture button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center"
                  aria-label="Capture photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/merchantLogos/camera2.png"
                    alt=""
                    className="h-10 w-10"
                  />
                </button>
              </>
            ) : capturedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedImage}
                alt="Captured product"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center" aria-live="polite">
                <p className="text-sm text-gray-400">
                  {cameraError || "Starting camera..."}
                </p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Instruction */}
          <p className="mt-3 text-center font-body text-xs italic text-gray-400">
            Take a picture of a single item in good lighting. The AI will
            identify and validate the product.
          </p>

          {/* AI Detection Result / Form */}
          {capturedImage && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-body text-sm font-bold text-[#034C52]">
                  AI Detection Result
                </span>
              </div>

              {/* Product Name (readonly at this stage) */}
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="mb-1 block font-body text-xs font-medium text-gray-500">Product Name</label>
                <p className="font-body text-base font-bold text-gray-800">
                  {isProcessing ? "Analyzing..." : productName || "—"}
                </p>
              </div>

              {/* Price & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price-capture" className="mb-1.5 block font-body text-xs font-medium text-gray-600">
                    Price (PHP)
                  </label>
                  <div className="flex w-full items-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-[#017075] focus-within:ring-1 focus-within:ring-[#017075]">
                    <span className="flex-shrink-0 font-body text-sm text-gray-500">
                      ₱
                    </span>
                    <div className="min-w-0 flex-1">
                      <input
                        id="price-capture"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-[#017075] bg-white px-3 py-2 font-body text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-[#017075] focus:ring-1 focus:ring-[#017075]"
                      />
                    </div>
                  </div>
                </div>
                <QuantitySelector
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2" role="alert">
                  <p className="font-body text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Continue Button */}
              <button
                type="button"
                onClick={handleContinue}
                disabled={!isFormValid || isProcessing}
                aria-disabled={!isFormValid || isProcessing}
                aria-describedby="continue-hint"
                className="mt-5 w-full rounded-2xl bg-[#f48d79] py-4 font-body text-base font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "Continue"
                )}
              </button>
              <span id="continue-hint" className="sr-only">
                {!isFormValid ? "Please enter a valid price and quantity" : isProcessing ? "AI is analyzing the image" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Stage 2 — Review ──
  if (stage === 2) {
    return (
      <div className="min-h-dvh bg-[#fdf2ed]">
        {/* Header */}
        <header className="flex items-center px-4 pt-5 pb-3">
          <Link
            href="/cart"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            aria-label="Back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#034C52"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center font-title text-[1.35rem] font-black text-[#034C52]">
            AI Image Scan
          </h1>
          <div className="w-9" />
        </header>

        <div className="h-px bg-gray-400" />

        {/* Progress */}
        <ProgressIndicator currentStep={2} />

        <div className="px-5 pb-8">
          {/* Title */}
          <div className="mt-2 text-center">
            <h2 className="font-body text-lg font-bold text-gray-900">
              Review Detected Item
            </h2>
            <p className="mt-1 font-body text-sm text-gray-500">
              Please review the details and make any necessary edits
            </p>
          </div>

          {/* Product Image */}
          {capturedImage && (
            <div className="mt-5 flex justify-center">
              <div className="h-28 w-28 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage}
                  alt={productName}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Edit Form */}
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
            {/* Product Name */}
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
              <label htmlFor="product-name" className="sr-only">Product Name</label>
              <input
                id="product-name"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="min-w-0 flex-1 font-body text-xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
                placeholder="Product name"
              />
              <button
                type="button"
                className="ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center"
                aria-label="Edit product name"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9e8e82"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>

            {/* Price & Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price-ai" className="mb-1.5 block font-body text-xs font-medium text-gray-600">
                  Price (PHP)
                </label>
                <div className="flex w-full items-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-[#017075] focus-within:ring-1 focus-within:ring-[#017075]">
                  <span className="flex-shrink-0 font-body text-sm text-gray-500">
                    ₱
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      id="price-ai"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-lg border border-[#017075] bg-white px-3 py-2 font-body text-sm text-gray-800 outline-none transition-colors focus:border-[#017075] focus:ring-1 focus:ring-[#017075]"
                    />
                  </div>
                  <button
                    type="button"
                    className="mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center"
                    aria-label="Edit price"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9e8e82"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-50"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                min={1}
              />
            </div>

            {/* Eligibility Toggle */}
            <div className="mt-5">
              <EligibilityToggle value={eligibility} onChange={setEligibility} />
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!productName || !isPriceValid || !eligibility}
            aria-disabled={!productName || !isPriceValid || !eligibility}
            aria-describedby="add-to-cart-hint"
            className="mt-5 w-full rounded-2xl bg-[#f48d79] py-4 font-body text-base font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to Cart
          </button>
          <span id="add-to-cart-hint" className="sr-only">
            {!productName ? "Enter a product name" : !isPriceValid ? "Enter a valid price greater than 0" : "Select an eligibility classification"}
          </span>
        </div>
      </div>
    );
  }

  // ── Stage 3 — Result ──
  const lastItem = useCartStore.getState().items.slice(-1)[0];
  const isLastItemEligible = lastItem?.eligibility === "eligible";

  return (
    <div className="min-h-dvh bg-[#fdf2ed]">
      {/* Header */}
        <header className="flex items-center px-4 pt-5 pb-3">
          <Link
            href="/cart"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            aria-label="Back"
          >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#034C52"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center font-title text-[1.35rem] font-black text-[#034C52]">
          AI Image Scan
        </h1>
        <div className="w-9" />
      </header>

      <div className="h-px bg-gray-400" />

      {/* Progress */}
      <ProgressIndicator currentStep={3} />

      <div className="px-5 pb-8">
        {/* Success/Error Banner */}
        {isLastItemEligible ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#10b981] bg-[#ecfdf5] px-4 py-3" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/green_correct.png"
              alt="Success"
              className="h-5 w-5 flex-shrink-0"
            />
            <span className="font-body text-sm font-semibold text-[#065f46]">
              Item added to cart successfully!
            </span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#ef4444] bg-[#fef2f2] px-4 py-3" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/red_wrong.png"
              alt="Not added"
              className="h-5 w-5 flex-shrink-0"
            />
            <span className="font-body text-sm font-semibold text-[#991b1b]">
              Item NOT added to cart.
            </span>
          </div>
        )}

        {/* Item Card */}
        {lastItem && (
          <div className="mt-5">
            <ItemCard
              name={lastItem.name}
              price={lastItem.price}
              quantity={lastItem.quantity}
              eligibility={lastItem.eligibility}
              imageDataUrl={lastItem.imageDataUrl}
            />
          </div>
        )}

        {/* Cart Summary */}
        <div className="mt-5">
          <CartSummary />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleAddAnother}
            className="w-full rounded-2xl bg-[#f48d79] py-4 font-body text-base font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95"
          >
            + Add Another Item
          </button>
          <Link
            href="/checkout"
            className="block w-full rounded-2xl bg-[#034C52] py-4 text-center font-body text-base font-bold text-white transition-colors hover:bg-[#017075] active:brightness-95"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
