"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export interface QrScannerProps {
  /** Fires once with the raw QR payload; the caller decides what happens next. */
  onResult: (qrString: string) => void;
  onError: (message: string) => void;
  /** Kid palette by default; "adult" for a parent paying from the family wallet. */
  tone?: "kid" | "adult";
}

/** Minimal shape of the native detector; not in every TS DOM lib yet. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

const SCAN_INTERVAL_MS = 100; // ~10fps

/**
 * Camera QR scanner for "pay a shop". Prefers the native BarcodeDetector API
 * when the browser has one, falls back to jsQR decoding canvas frames.
 * Always offers a "type it instead" fallback for devices/tests without a
 * usable camera.
 */
export function QrScanner({ onResult, onError, tone = "kid" }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function stopStream() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    function finish(value: string) {
      if (cancelled) return;
      cancelled = true;
      if (intervalId !== undefined) clearInterval(intervalId);
      stopStream();
      onResult(value);
    }

    async function scanFrame(detector: BarcodeDetectorLike | null) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);

      if (detector) {
        try {
          const codes = await detector.detect(canvas);
          const value = codes[0]?.rawValue;
          if (value) {
            finish(value);
            return;
          }
        } catch {
          // Native detector had a bad frame; jsQR below gets a chance too.
        }
      }

      const imageData = ctx.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, width, height);
      if (code?.data) finish(code.data);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError("This device can't use the camera. Type the code instead.");
        setManualEntry(true);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (cancelled) return;
        onError("Couldn't reach the camera. Type the code instead.");
        setManualEntry(true);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Autoplay can reject before the first user gesture; the interval
          // below keeps trying frames once it's actually playing.
        }
      }
      if (cancelled) return;
      setCameraReady(true);

      let detector: BarcodeDetectorLike | null = null;
      const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector;
      if (BarcodeDetectorCtor) {
        try {
          detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }

      intervalId = setInterval(() => {
        void scanFrame(detector);
      }, SCAN_INTERVAL_MS);
    }

    void start();

    return () => {
      cancelled = true;
      if (intervalId !== undefined) clearInterval(intervalId);
      stopStream();
    };
  }, [onResult, onError]);

  function submitManual() {
    const value = manualValue.trim();
    if (value) onResult(value);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-ink">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        {cameraReady && (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-white/80" />
        )}
      </div>

      <p className="text-lg font-semibold text-ink/80">Point at the shop&apos;s code</p>

      {!manualEntry && (
        <button
          type="button"
          onClick={() => setManualEntry(true)}
          className={`text-base font-semibold underline underline-offset-4 ${tone === "adult" ? "text-forest" : "text-kid-teal"}`}
        >
          Type it instead
        </button>
      )}

      {manualEntry && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <textarea
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Paste or type the code's text"
            rows={4}
            className="w-full rounded-2xl border border-ink/20 bg-white p-3 text-base text-ink"
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={!manualValue.trim()}
            className={`rounded-2xl px-4 py-3 text-lg font-bold text-white disabled:opacity-40 ${tone === "adult" ? "bg-forest" : "bg-kid-teal"}`}
          >
            Use this code
          </button>
        </div>
      )}
    </div>
  );
}
