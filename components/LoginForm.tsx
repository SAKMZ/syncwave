"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not sign in.");
      setPassword("");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-[100dvh] max-w-md place-content-center px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="sw-glass grid gap-4 p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
          <Lock className="size-3.5" /> Admin
        </div>
        <h1 className="font-display text-3xl font-bold">
          <span className="sw-gradient-text">Sign in</span>
        </h1>

        <div>
          <Label className="mb-1.5 block">Password</Label>
          <Input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button variant="accent" size="lg" onClick={login} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-xs text-muted">
          Lost the password? Delete <code className="text-accent-2">data/admin.json</code>{" "}
          on the server and reload to run setup again.
        </p>
      </div>
    </main>
  );
}
