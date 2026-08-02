// Persisted instance settings: LLM provider config + AI DJ toggle/persona.
// Process-global singleton so Next routes and the custom server share it.
import { loadSync, saveNow } from "./store.mjs";
import { PERSONAS } from "./personas.mjs";

const DEFAULTS = {
  llmProvider: process.env.LLM_PROVIDER || "ollama", // openai | anthropic | google | ollama
  llmModel: process.env.LLM_MODEL || "llama3.1",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmBaseUrl: process.env.LLM_BASE_URL || "http://localhost:11434",
  aiDjEnabled: process.env.AI_DJ_ENABLED === "true",
  personaId: PERSONAS[0].id,
  // Proxy pool, for hosts whose IP YouTube refuses. Settable here so a VPS can
  // be fixed from the browser instead of an SSH session and a restart; the
  // matching env vars still win, so a compose file stays the source of truth
  // where someone has chosen to configure it that way.
  webshareApiKey: process.env.WEBSHARE_API_KEY || "",
  proxyList: process.env.YTDLP_PROXY_LIST || "",
};

const state =
  (globalThis.__SW_SETTINGS ??= { ...DEFAULTS, ...loadSync("settings", {}) });

export function getSettings() {
  return { ...state };
}

// Never leak secrets to the browser. Proxy URLs embed their own credentials,
// so the list is reported as a count rather than echoed back.
export function getPublicSettings() {
  const { llmApiKey, webshareApiKey, proxyList, ...rest } = state;
  return {
    ...rest,
    hasApiKey: Boolean(llmApiKey),
    hasWebshareKey: Boolean(webshareApiKey),
    proxyListCount: String(proxyList || "")
      .split(",")
      .filter((s) => s.trim()).length,
  };
}

export async function updateSettings(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULTS && v !== undefined) state[k] = v;
  }
  await saveNow("settings", state);
  return getPublicSettings();
}

export function activePersona() {
  return PERSONAS.find((p) => p.id === state.personaId) || PERSONAS[0];
}
