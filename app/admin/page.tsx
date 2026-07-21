"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Persona = { id: string; name: string; tagline: string };
type Settings = {
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  aiDjEnabled: boolean;
  personaId: string;
  hasApiKey?: boolean;
};

export default function AdminPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setS(d.settings);
        setPersonas(d.personas);
      });
  }, []);

  if (!s) return <main className="p-8 text-muted">Loading…</main>;

  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

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
    const d = await res.json();
    setS(d.settings);
    setApiKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const selectCls =
    "w-full rounded-md border border-input bg-field px-3 py-2 text-sm text-ink focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <Settings className="size-3.5" /> Setup
      </div>
      <h1 className="mb-8 font-display text-4xl font-bold">
        <span className="sw-gradient-text">Syncwave</span>
        <span className="text-ink"> settings</span>
      </h1>

      {/* AI DJ */}
      <section className="mb-6 sw-glass p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">AI DJ</h2>
            <p className="text-sm text-muted">
              Announces tracks and takes <code className="text-accent-2">/dj</code> requests in chat.
            </p>
          </div>
          <Switch
            checked={s.aiDjEnabled}
            onCheckedChange={(v: boolean) => set({ aiDjEnabled: v })}
          />
        </div>

        <div className="mt-5">
          <Label className="mb-1.5 block">Persona</Label>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => set({ personaId: p.id })}
                className={`rounded-md border p-3 text-left transition-colors ${
                  s.personaId === p.id
                    ? "border-[var(--accent)] bg-accent-soft"
                    : "border-soft-border hover:bg-white/5"
                }`}
              >
                <div className="text-sm font-semibold text-ink">{p.name}</div>
                <div className="text-xs text-muted">{p.tagline}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* LLM provider */}
      <section className="mb-6 sw-glass p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Language model</h2>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1.5 block">Provider</Label>
            <select
              className={selectCls}
              value={s.llmProvider}
              onChange={(e) => set({ llmProvider: e.target.value })}
            >
              <option value="ollama">Ollama (local)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block">Model</Label>
            <Input
              value={s.llmModel}
              onChange={(e) => set({ llmModel: e.target.value })}
              placeholder="e.g. llama3.1 / gpt-4o-mini / claude-haiku-4-5"
            />
          </div>
          {s.llmProvider === "ollama" && (
            <div>
              <Label className="mb-1.5 block">Base URL</Label>
              <Input
                value={s.llmBaseUrl}
                onChange={(e) => set({ llmBaseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}
          {s.llmProvider !== "ollama" && (
            <div>
              <Label className="mb-1.5 block">
                API key {s.hasApiKey && <span className="text-accent-2">· saved</span>}
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={s.hasApiKey ? "•••••••• (leave blank to keep)" : "sk-…"}
              />
            </div>
          )}
        </div>
      </section>

      <Button variant="accent" size="lg" onClick={save} disabled={saving} className="gap-1.5">
        {saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : saving ? "Saving…" : "Save settings"}
      </Button>
    </main>
  );
}
