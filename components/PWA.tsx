"use client";

import { useEffect } from "react";

// Registers the service worker so Syncwave is installable as a PWA.
export default function PWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
