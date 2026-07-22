"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Cookie, Bot, Check, Loader2, ArrowRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CookiesPanel from "@/components/CookiesPanel";
import AiDjSettings from "@/components/AiDjSettings";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants.mjs";

const STEPS = [
  { id: 1, label: "Admin password", icon: Lock },
  { id: 2, label: "YouTube access", icon: Cookie },
  { id: 3, label: "AI DJ", icon: Bot },
] as const;

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPassword() {
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setup", password }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not set the password.");
      return;
    }
    setPassword("");
    setConfirm("");
    setStep(2);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <PartyPopper className="size-3.5" /> First-run setup
      </div>
      <h1 className="mb-2 font-display text-4xl font-bold">
        <span className="sw-gradient-text">Welcome to Syncwave</span>
      </h1>
      <p className="mb-8 text-muted">
        Three quick steps and your listening room is ready. Only the first is required.
      </p>

      {/* Progress */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? "border-[var(--accent)] bg-accent-soft text-accent-2"
                    : active
                      ? "border-[var(--accent)] text-accent-2"
                      : "border-soft-border text-muted"
                }`}
              >
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <span
                className={`hidden text-sm sm:block ${active ? "text-ink" : "text-muted"}`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-soft-border" />}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — password */}
      {step === 1 && (
        <section className="sw-glass grid gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Create an admin password</h2>
            <p className="mt-1 text-sm text-muted">
              This protects the settings console. Anyone with your room links can
              still listen — this only guards configuration.
            </p>
          </div>

          <div className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-accent-soft p-4 text-sm text-muted">
            Do this now. Until a password is set, anyone who reaches this server
            can claim it.
          </div>

          <div>
            <Label className="mb-1.5 block">Password</Label>
            <Input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Confirm password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPassword()}
              placeholder="Type it again"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <div>
            <Button
              variant="accent"
              size="lg"
              onClick={createPassword}
              disabled={busy}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Set password
              {!busy && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </section>
      )}

      {/* Step 2 — cookies */}
      {step === 2 && (
        <section className="sw-glass grid gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">YouTube access</h2>
            <p className="mt-1 text-sm text-muted">
              Optional, but playback will fail on most cloud hosts without it.
            </p>
          </div>
          <CookiesPanel />
          <div className="flex gap-2">
            <Button variant="accent" size="lg" onClick={() => setStep(3)} className="gap-1.5">
              Continue <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => setStep(3)}>
              Skip for now
            </Button>
          </div>
        </section>
      )}

      {/* Step 3 — AI DJ */}
      {step === 3 && (
        <section className="grid gap-4">
          <p className="text-sm text-muted">
            Leave this off for a plain listening room — you can turn it on any
            time from the admin console.
          </p>
          <AiDjSettings saveLabel="Save and finish" onSaved={() => router.push("/admin")} />
          <div>
            <Button variant="outline" size="lg" onClick={() => router.push("/admin")}>
              Skip and finish
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
