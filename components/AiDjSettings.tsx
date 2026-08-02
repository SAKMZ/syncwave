"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

type Persona = {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  description: string;
};
type Settings = {
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  aiDjEnabled: boolean;
  personaId: string;
  hasApiKey?: boolean;
};
type TestResult = {
  ok: boolean;
  provider?: string;
  model?: string;
  reply?: string;
  error?: string;
};

const selectCls =
  "w-full rounded-md border border-input bg-field px-3 py-2 text-sm text-ink focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

/**
 * What each provider needs, and where to get it.
 *
 * A key field labelled "sk-…" is a small lie for three of these four, and
 * "which model string does this one want" is the question that actually stops
 * people — so both come from here rather than being hard-coded to OpenAI.
 */
const PROVIDERS: Record<
  string,
  { label: string; model: string; keyHint?: string; note?: React.ReactNode }
> = {
  ollama: {
    label: "Ollama (local, no key)",
    model: "llama3.1",
    note: "Runs on this machine. Nothing leaves it, and there is nothing to pay for.",
  },
  google: {
    label: "Google Gemini (free tier)",
    // A *lite* model on purpose. The DJ writes two sentences between tracks, so
    // latency is the whole experience — and the heavier reasoning models spend
    // so long thinking that they can return nothing at all within a sane token
    // budget. Measured on this prompt set: flash-lite answers every DJ call in
    // under a second; a 26B reasoning model took 86 seconds and still came back
    // empty.
    model: "gemini-3.5-flash-lite",
    keyHint: "AIza…",
    note: (
      <>
        Create a key at{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-2 underline-offset-4 hover:underline"
        >
          aistudio.google.com/apikey
        </a>
        . Gemini has a free tier — for a DJ that speaks once a track, a room of
        friends is unlikely to leave it. Prefer a <strong>lite</strong> model:
        the DJ is judged on how fast it answers, not on how hard it thinks.
      </>
    ),
  },
  openai: { label: "OpenAI", model: "gpt-4o-mini", keyHint: "sk-…" },
  anthropic: { label: "Anthropic", model: "claude-haiku-4-5", keyHint: "sk-ant-…" },
};

export default function AiDjSettings({
  saveLabel = "Save settings",
  onSaved,
}: {
  saveLabel?: string;
  onSaved?: () => void;
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setS(d.settings);
        setPersonas(d.personas);
      })
      .catch(() => {});
  }, []);

  if (!s) return <p className="text-sm text-muted">Loading…</p>;

  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  // An instance configured before a provider existed, or by hand in .env, can
  // hold a name this build doesn't know. Fall back rather than crash on it.
  const provider = PROVIDERS[s.llmProvider] ?? PROVIDERS.openai;

  async function save() {
    if (!s) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      llmProvider: s.llmProvider,
      llmModel: s.llmModel,
      llmBaseUrl: s.llmBaseUrl,
      aiDjEnabled: s.aiDjEnabled,
      personaId: s.personaId,
    };
    if (apiKey.trim()) payload.llmApiKey = apiKey.trim();
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const d = await res.json();
      setS(d.settings);
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      // Last result described the old settings; keeping it on screen next to
      // new ones is worse than showing nothing.
      setTest(null);
      onSaved?.();
    }
    setSaving(false);
  }

  /** Save first, then ask the model to say one word. */
  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      await save();
      const res = await fetch("/api/admin/dj-test", { method: "POST" });
      setTest(
        res.ok
          ? await res.json()
          : { ok: false, error: `The server refused the check (${res.status}).` }
      );
    } catch {
      setTest({ ok: false, error: "Could not reach the server." });
    }
    setTesting(false);
  }

  return (
    <div className="grid gap-6">
      <section className="sw-glass p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">AI DJ</h2>
            <p className="text-sm text-muted">
              Announces tracks and takes <code className="text-accent-2">/dj</code> requests
              in chat. Entirely optional.
            </p>
          </div>
          <Switch
            checked={s.aiDjEnabled}
            onCheckedChange={(v: boolean) => set({ aiDjEnabled: v })}
          />
        </div>

        {s.aiDjEnabled && (
          <div className="mt-6">
            <Label className="mb-1 block">Persona</Label>
            <p className="mb-3 text-xs text-muted">
              Shapes how it talks between tracks and what it reaches for when the room asks it
              for something. An explicit request is always played as asked.
            </p>
            <div
              role="radiogroup"
              aria-label="AI DJ persona"
              className="grid gap-2 sm:grid-cols-2"
            >
              {personas.map((p) => {
                const selected = s.personaId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set({ personaId: p.id })}
                    className={cn(
                      "sw-card sw-focus flex gap-3 p-3 text-left",
                      selected
                        ? "border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] bg-accent-soft shadow-[var(--glow-accent)]"
                        : "sw-card-hover"
                    )}
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-base"
                      aria-hidden
                    >
                      {p.avatar}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-ink">{p.name}</span>
                        {selected && (
                          <Check className="size-3.5 shrink-0 text-[var(--accent-2)]" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{p.tagline}</span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-ink-soft/70">
                        {p.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {s.aiDjEnabled && (
        <section className="sw-glass p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Language model</h2>
          <div className="grid gap-4">
            <div>
              <Label className="mb-1.5 block">Provider</Label>
              <select
                className={selectCls}
                value={s.llmProvider}
                onChange={(e) => {
                  const next = e.target.value;
                  // Carry the model across only if it was never set for the old
                  // provider; "llama3.1" sent to Gemini is a confusing 404.
                  const wasDefault = Object.values(PROVIDERS).some((p) => p.model === s.llmModel);
                  set({
                    llmProvider: next,
                    llmModel: wasDefault || !s.llmModel ? PROVIDERS[next].model : s.llmModel,
                  });
                }}
              >
                {Object.entries(PROVIDERS).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {provider.note && (
                <p className="mt-2 text-xs leading-relaxed text-muted">{provider.note}</p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block">Model</Label>
              <Input
                value={s.llmModel}
                onChange={(e) => set({ llmModel: e.target.value })}
                placeholder={provider.model}
              />
            </div>
            {s.llmProvider === "ollama" ? (
              <div>
                <Label className="mb-1.5 block">Base URL</Label>
                <Input
                  value={s.llmBaseUrl}
                  onChange={(e) => set({ llmBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block">
                  API key {s.hasApiKey && <span className="text-accent-2">· saved</span>}
                </Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    s.hasApiKey ? "•••••••• (leave blank to keep)" : provider.keyHint
                  }
                />
              </div>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={save} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          {saved ? "Saved" : saving ? "Saving…" : saveLabel}
        </Button>

        {/* The DJ is deliberately silent when it fails, so that a broken model
            can never take playback down. The cost of that is no way to tell a
            quiet DJ from a misconfigured one — this is it. */}
        {s.aiDjEnabled && (
          <Button
            variant="outline"
            size="lg"
            onClick={runTest}
            disabled={testing || saving}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : null}
            {testing ? "Asking…" : "Test the DJ"}
          </Button>
        )}
      </div>

      {test && (
        <div
          role="status"
          className={cn(
            "sw-card sw-fade-in flex gap-3 p-4 text-sm",
            test.ok
              ? "border-[color:color-mix(in_oklab,var(--success)_45%,transparent)]"
              : "border-[color:color-mix(in_oklab,var(--destructive)_45%,transparent)]"
          )}
        >
          {test.ok ? (
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--destructive)]" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {test.ok ? "The DJ answered." : "The DJ could not answer."}
            </p>
            <p className="mt-1 break-words text-muted">
              {test.ok ? (
                <>
                  <code className="font-mono text-ink-soft">{test.model}</code> on {test.provider}{" "}
                  replied “{test.reply}”.
                </>
              ) : (
                test.error
              )}
            </p>
            {!test.ok && /model name format|not found|NOT_FOUND/i.test(test.error ?? "") && (
              <p className="mt-2 text-xs text-muted">
                Model IDs are lower-case and provider-specific — an Ollama model name won&rsquo;t
                work on Gemini. Try <code className="font-mono text-ink-soft">{provider.model}</code>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
