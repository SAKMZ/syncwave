"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const { code: newCode, ownerToken } = await res.json();
      // Persist the durable owner token so this browser reclaims host on return.
      if (ownerToken) localStorage.setItem(`sw_owner_${newCode}`, ownerToken);
      router.push(`/r/${newCode}?host=1`);
    } catch {
      setError("Could not create a room. Is the server still running?");
      setLoading(false);
    }
  }

  // Guests arriving with a code spoken aloud had no way in before this — the
  // page only told them to go find a link.
  async function join() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return;
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(c)}`);
      if (!res.ok) {
        setError(`No room called ${c}. Check the code and try again.`);
        setJoining(false);
        return;
      }
      router.push(`/r/${c}`);
    } catch {
      setError("Could not reach the server.");
      setJoining(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <Button
        variant="accent"
        size="lg"
        onClick={start}
        disabled={loading}
        className="h-12 gap-2 px-7 text-sm"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
        {loading ? "Creating room…" : "Start a room"}
      </Button>

      <div className="flex w-full max-w-xs items-center gap-3 text-[11px] font-semibold tracking-eyebrow text-muted/70 uppercase">
        <span className="h-px flex-1 bg-white/10" />
        or join one
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex w-full max-w-xs items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && join()}
          maxLength={6}
          placeholder="ROOM CODE"
          aria-label="Room code"
          spellCheck={false}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.04] px-4 text-center font-mono text-sm tracking-[0.3em] text-ink placeholder:tracking-[0.18em] placeholder:text-muted/60 focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        />
        <Button
          variant="outline"
          onClick={join}
          disabled={joining || code.trim().length < 4}
          className="h-11 shrink-0 gap-1.5 px-4"
        >
          {joining ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Join
        </Button>
      </div>

      {error && (
        <p className="max-w-sm text-center text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
