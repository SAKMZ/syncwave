// Persisted instance settings: LLM provider config + AI DJ toggle/persona.
// Process-global singleton so Next routes and the custom server share it.
import { loadSync, saveNow } from "./store.mjs";
import { PERSONAS } from "./personas.mjs";

const DEFAULTS = {
  llmProvider: process.env.LLM_PROVIDER || "ollama", // openai | anthropic | ollama
  llmModel: process.env.LLM_MODEL || "llama3.1",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmBaseUrl: process.env.LLM_BASE_URL || "http://localhost:11434",
  aiDjEnabled: process.env.AI_DJ_ENABLED === "true",
  personaId: PERSONAS[0].id,
};

const state =
  (globalThis.__SW_SETTINGS ??= { ...DEFAULTS, ...loadSync("settings", {}) });

export function getSettings() {
  return { ...state };
}

// Never leak the API key to the browser.
export function getPublicSettings() {
  const { llmApiKey, ...rest } = state;
  return { ...rest, hasApiKey: Boolean(llmApiKey) };
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
