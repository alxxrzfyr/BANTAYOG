"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { QuantitySelector } from "@/components/merchant/quantity-selector";
import { EligibilityToggle } from "@/components/merchant/eligibility-toggle";
import { useCameraPreview } from "@/hooks/use-camera-preview";

// ---------------------------------------------------------------------------
// Manual Input Flow — 3 visual states (ref: 22-24.png)
// ---------------------------------------------------------------------------

type VisualState = "blank" | "eligible" | "ineligible";

const MOCK_FOOD_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export default function ManualInputPage() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const setInputSource = useCartStore((s) => s.setInputSource);
  const items = useCartStore((s) => s.items);

  // ── Form state ──
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [eligibility, setEligibility] = useState<
    "eligible" | "ineligible" | null
  >(null);
  const [visualState, setVisualState] = useState<VisualState>("blank");

  // ── Camera state ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const {
    status: cameraStatus,
    errorMsg: cameraErrorMsg,
    retryCount,
    startCamera,
    stopCamera,
    retry: handleRetryCamera,
  } = useCameraPreview(videoRef);

  // ── Start/stop camera based on state ──
  useEffect(() => {
    if (!capturedImage) {
      startCamera("environment");
    } else {
      stopCamera();
    }
  }, [capturedImage, startCamera, stopCamera]);

  // ── Capture photo ──
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      setCapturedImage(MOCK_FOOD_IMAGE);
      stopCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCapturedImage(MOCK_FOOD_IMAGE);
      stopCamera();
      return;
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  // ── Handle eligibility selection ──
  const handleEligibilityChange = (value: "eligible" | "ineligible") => {
    setEligibility(value);
    setVisualState(value);
  };

  // ── Validate form ──
  const priceValue = parseFloat(price);
  const isPriceValid = !isNaN(priceValue) && priceValue > 0;
  const isQuantityValid = quantity >= 1;
  const isNameValid = productName.trim().length > 0;
  const hasImage = capturedImage !== null;
  const isFormComplete = hasImage && isNameValid && isPriceValid && isQuantityValid && eligibility !== null;

  // ── Add Another Item ──
  const handleAddAnother = () => {
    // Only add if eligible and form is complete
    if (isFormComplete && eligibility === "eligible") {
      addItem({
        name: productName.trim(),
        price: priceValue,
        quantity,
        eligibility: "eligible",
        imageDataUrl: capturedImage || undefined,
      });
      setInputSource("manual");
    }

    // Reset form
    setProductName("");
    setPrice("");
    setQuantity(1);
    setEligibility(null);
    setVisualState("blank");
    setCapturedImage(null);
  };

  // ── Proceed to Checkout ──
  const handleProceedToCheckout = () => {
    // Add current item if eligible and form is complete
    if (isFormComplete && eligibility === "eligible") {
      addItem({
        name: productName.trim(),
        price: priceValue,
        quantity,
        eligibility: "eligible",
        imageDataUrl: capturedImage || undefined,
      });
      setInputSource("manual");
    }

    // Check if cart has any eligible items
    const hasEligibleItems =
      items.some((i) => i.eligibility === "eligible") ||
      (isFormComplete && eligibility === "eligible");

    if (hasEligibleItems) {
      router.push("/checkout");
    }
    // If no eligible items, do nothing (button should be disabled anyway)
  };

  const hasAnyItemInCart = items.length > 0;
  const canProceed = hasImage && isNameValid && isPriceValid && isQuantityValid && (hasAnyItemInCart || (eligibility !== null));

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
          Manual Input
        </h1>
        <div className="w-9" />
      </header>

      <div className="h-px bg-gray-400" />

      <div className="px-5 pb-8">
        {/* Image Capture Area */}
        <div className="mt-5 flex justify-center">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border-[3px] border-[#b2dfdb] bg-gray-100">
            {capturedImage ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured product"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    setEligibility(null);
                    setVisualState("blank");
                  }}
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1.5 font-body text-xs font-bold text-white transition-colors hover:bg-black/80"
                >
                  Retake
                </button>
              </div>
            ) : (cameraStatus === "ready" || cameraStatus === "loading") ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                  aria-label="Camera viewfinder for capturing product image"
                />
                {cameraStatus === "loading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-[#E3F0F2]" aria-live="polite">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#034C52] border-t-transparent" />
                    <p className="text-xs font-semibold text-[#034C52]/60">
                      Camera starting...
                    </p>
                  </div>
                )}
                {cameraStatus === "ready" && (
                  <>
                    {/* Corner brackets */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-3 top-3 h-8 w-8 border-l-[3px] border-t-[3px] border-[#80cbc4]" />
                      <div className="absolute right-3 top-3 h-8 w-8 border-r-[3px] border-t-[3px] border-[#80cbc4]" />
                      <div className="absolute bottom-3 left-3 h-8 w-8 border-b-[3px] border-l-[3px] border-[#80cbc4]" />
                      <div className="absolute bottom-3 right-3 h-8 w-8 border-b-[3px] border-r-[3px] border-[#80cbc4]" />
                    </div>
                    {/* Camera button */}
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center"
                      aria-label="Capture photo"
                    >
                      <img
                        src="/merchantLogos/camera2.png"
                        alt=""
                        className="h-10 w-10"
                      />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col aspect-[4/3] w-full items-center justify-center gap-3 p-4 text-center bg-[#E3F0F2]" aria-live="polite">
                <p className="text-xs font-semibold text-[#034C52]/60">
                  {cameraStatus === "timeout" ? "Camera activation timed out." : (cameraErrorMsg || "Camera unavailable")}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleRetryCamera}
                    disabled={retryCount >= 3}
                    className="rounded-full bg-[#034C52] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#034C52]/90 disabled:opacity-50"
                  >
                    Retry ({retryCount}/3)
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Form Card */}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
          {/* Product Name */}
          <div className="mb-4">
            <label htmlFor="product-name" className="mb-1.5 block font-body text-sm font-bold text-gray-800">
              Product Name
            </label>
            <input
              id="product-name"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name"
              className="w-full font-body text-xl font-bold text-gray-900 outline-none placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price-manual" className="mb-1.5 block font-body text-xs font-medium text-gray-600">
                Price (PHP)
              </label>
              <div className="flex w-full items-center gap-2 overflow-hidden rounded-xl border border-gray-200 px-3 py-2 transition-colors focus-within:border-[#017075] focus-within:ring-1 focus-within:ring-[#017075] bg-gray-50">
                <span className="flex-shrink-0 font-body text-sm text-gray-500">
                  ₱
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    id="price-manual"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[#017075] bg-white px-3 py-2 font-body text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-[#017075] focus:ring-1 focus:ring-[#017075] disabled:cursor-not-allowed"
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

          {/* Eligibility Toggle */}
          <div className="mt-5">
            <EligibilityToggle
              value={eligibility}
              onChange={handleEligibilityChange}
            />
          </div>
        </div>

        {/* Status Message */}
        {visualState === "eligible" && (
          <div className="mt-4 flex justify-center" aria-live="polite">
            <span className="rounded-full border border-[#10b981] bg-[#ecfdf5] px-4 py-1.5 font-body text-xs font-semibold text-[#065f46]">
              Item will be added to cart
            </span>
          </div>
        )}
        {visualState === "ineligible" && (
          <div className="mt-4 flex justify-center" aria-live="polite">
            <span className="rounded-full border border-[#ef4444] bg-[#fef2f2] px-4 py-1.5 font-body text-xs font-semibold text-[#991b1b]">
              Item will NOT be added to cart
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleAddAnother}
            disabled={!isFormComplete}
            aria-disabled={!isFormComplete}
            aria-describedby="add-another-hint"
            className="w-full rounded-2xl bg-[#f48d79] py-4 font-body text-base font-bold text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Another Item
          </button>
          <span id="add-another-hint" className="sr-only">
            {!hasImage ? "Please capture a product image" : !isNameValid ? "Enter a product name" : !isPriceValid ? "Enter a valid price greater than 0" : !eligibility ? "Select an eligibility classification" : ""}
          </span>
          <button
            type="button"
            onClick={handleProceedToCheckout}
            disabled={!canProceed}
            aria-disabled={!canProceed}
            aria-describedby="proceed-hint"
            className="w-full rounded-2xl bg-[#034C52] py-4 font-body text-base font-bold text-white transition-colors hover:bg-[#017075] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proceed to Checkout
          </button>
          <span id="proceed-hint" className="sr-only">
            {!canProceed ? (!hasImage ? "Please capture a product image" : "Add at least one eligible item to proceed") : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
