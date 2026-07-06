"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type CameraStatus = "idle" | "loading" | "ready" | "error" | "timeout";

export function useCameraPreview(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const facingModeRef = useRef<"user" | "environment">("environment");

  const stopCamera = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, [videoRef]);

  const startCamera = useCallback(async (facingMode: "user" | "environment" = "environment") => {
    stopCamera();
    setStatus("loading");
    setErrorMsg(null);
    facingModeRef.current = facingMode;

    // Set up watchdog timer: 10 seconds to start rendering frames
    watchdogRef.current = setTimeout(() => {
      setStatus("timeout");
      setErrorMsg("Camera activation timed out. No frames were rendered.");
      stopCamera();
    }, 10_000);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // When video starts playing, clear the watchdog and mark status as ready
        videoRef.current.onplaying = () => {
          if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
          }
          setStatus("ready");
          setErrorMsg(null);
          // Reset retry count on successful play
          setRetryCount(0);
        };
      }
    } catch (err: any) {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      setStatus("error");
      setErrorMsg(err.message || "Failed to access camera.");
    }
  }, [videoRef, stopCamera]);

  const retry = useCallback(() => {
    if (retryCount >= 3) {
      setErrorMsg("Maximum retry attempts reached.");
      return;
    }
    setRetryCount((prev) => prev + 1);
    startCamera(facingModeRef.current);
  }, [retryCount, startCamera]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    status,
    errorMsg,
    retryCount,
    startCamera,
    stopCamera,
    retry,
  };
}
