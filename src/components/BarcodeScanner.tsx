"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

type ScanState = "starting" | "scanning" | "error";

interface Props {
  /** Called once with the decoded barcode; the parent should then unmount this component. */
  onScan: (code: string) => void;
}

function describeCameraError(err: unknown): string {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (text.includes("NotAllowedError") || text.includes("Permission"))
    return "Camera access was denied. Allow camera access for this site in your browser settings, then reload.";
  if (text.includes("NotFoundError"))
    return "No camera was found on this device. Use Search instead.";
  if (text.includes("NotReadableError"))
    return "The camera is in use by another app. Close it and try again.";
  if (text.includes("insecure-context"))
    return "Camera scanning needs a secure (HTTPS) connection. Use Search instead.";
  return "Couldn't start the camera. Use Search instead.";
}

export default function BarcodeScanner({ onScan }: Props) {
  const [state, setState] = useState<ScanState>("starting");
  const [errorMsg, setErrorMsg] = useState("");
  // Keep the latest callback without restarting the camera on re-render
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let cancelled = false;
    let fired = false;

    (async () => {
      try {
        // getUserMedia only exists on HTTPS or localhost
        if (!window.isSecureContext) throw new Error("insecure-context");

        // Dynamic import: html5-qrcode touches browser APIs at load time
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (cancelled) return;

        scanner = new Html5Qrcode("scanner-view", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });

        await scanner.start(
          { facingMode: "environment" }, // back camera on phones
          { fps: 10 },
          (decoded) => {
            if (fired) return;
            fired = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onScanRef.current(decoded);
          },
          () => {
            /* per-frame "no barcode in view" — expected, ignore */
          }
        );

        if (cancelled) {
          await scanner.stop();
          return;
        }
        setState("scanning");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(describeCameraError(err));
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanner?.isScanning) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black ring-1 ring-line">
      <div id="scanner-view" className="scanner-view absolute inset-0" />

      {state === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-mute">
          <Loader2 className="size-7 animate-spin text-accent" />
          <p className="text-sm">Requesting camera…</p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 ring-1 ring-danger/30">
            <CameraOff className="size-6 text-danger" />
          </div>
          <p className="text-sm text-ink-dim">{errorMsg}</p>
        </div>
      )}

      {state === "scanning" && (
        <div className="pointer-events-none absolute inset-0">
          {/* corner brackets */}
          <div className="absolute left-6 top-6 size-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-accent" />
          <div className="absolute right-6 top-6 size-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-accent" />
          <div className="absolute bottom-6 left-6 size-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-accent" />
          <div className="absolute bottom-6 right-6 size-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-accent" />
          {/* sweeping laser line */}
          <div className="laser absolute left-10 right-10 h-0.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(163,230,53,0.6)]" />
          <p className="absolute bottom-4 left-0 right-0 text-center text-xs font-medium text-ink-dim [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
            Point at a barcode — it scans automatically
          </p>
        </div>
      )}
    </div>
  );
}
