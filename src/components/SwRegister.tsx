"use client";

import { useEffect } from "react";

/** Registers the push service worker once per session (no-op if unsupported). */
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
