// AI DJ — thin layer over the Vercel AI SDK. Swappable provider (openai /
// anthropic / ollama). Generates short between-track intros and interprets
// plain-language chat requests into a search query. Every call is wrapped so a
// missing/unreachable LLM never breaks playback — the DJ just stays quiet.

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getSettings, activePersona } from "./settings.mjs";

function getModel() {
  const s = getSettings();
  if (s.llmProvider === "anthropic") {
    return createAnthropic({ apiKey: s.llmApiKey })(s.llmModel);
  }
  if (s.llmProvider === "ollama") {
    // Ollama exposes an OpenAI-compatible endpoint at /v1.
    const base = (s.llmBaseUrl || "http://localhost:11434").replace(/\/$/, "");
    return createOpenAI({ baseURL: `${base}/v1`, apiKey: "ollama" })(s.llmModel);
  }
  return createOpenAI({ apiKey: s.llmApiKey })(s.llmModel);
}

export function djEnabled() {
  return getSettings().aiDjEnabled;
}

export function djName() {
  return activePersona().name;
}

/** Short spoken-style intro for a track. Returns null on any failure. */
export async function generateIntro(track) {
  try {
    const persona = activePersona();
    const { text } = await generateText({
      model: getModel(),
      system: persona.prompt,
      prompt: `Introduce this track for the room in your voice, max 2 short sentences, no quotes:\n"${track.title}" by ${track.artist}.`,
      maxTokens: 80,
    });
    return text.trim().slice(0, 300);
  } catch {
    return null;
  }
}

/** Interpret a chat request into a search query, or null if it isn't one. */
export async function interpretRequest(message) {
  try {
    const { text } = await generateText({
      model: getModel(),
      system:
        "You turn a listener's chat message into a YouTube Music search query for ONE song or vibe. Reply with ONLY the query, nothing else. If the message is not a music request, reply with exactly NONE.",
      prompt: message,
      maxTokens: 30,
    });
    const q = text.trim().replace(/^["']|["']$/g, "");
    if (!q || /^none$/i.test(q)) return null;
    return q.slice(0, 120);
  } catch {
    return null;
  }
}
