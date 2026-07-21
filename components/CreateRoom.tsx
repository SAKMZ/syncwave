"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CreateRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const { code, ownerToken } = await res.json();
      // Persist the durable owner token so this browser reclaims host on return.
      if (ownerToken) localStorage.setItem(`sw_owner_${code}`, ownerToken);
      router.push(`/r/${code}?host=1`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button variant="accent" size="lg" onClick={start} disabled={loading}>
      {loading ? "Creating room…" : "Start a room"}
    </Button>
  );
}
