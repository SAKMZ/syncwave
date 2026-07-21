"use client";

import { useEffect } from "react";

// Swaps the page's <link rel="manifest"> to the room-specific manifest so that
// installing this room produces an app whose start_url is THIS room. Done client
// side because per-route metadata conflicts with the file-based app/manifest.ts.
export default function RoomManifest({ code }: { code: string }) {
  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = `/api/room-manifest?code=${code}`;
  }, [code]);
  return null;
}
