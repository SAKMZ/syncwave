// AI DJ — thin layer over the Vercel AI SDK. Swappable provider (openai /
// anthropic / ollama). Generates short between-track intros, interprets
// plain-language chat requests into a search query, and suggests what to play
// next. Every call is wrapped so a missing/unreachable LLM never breaks
// playback — the DJ just stays quiet and the room falls back to plain search.

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

export function djAvatar() {
  return activePersona().avatar;
}

/**
 * One line of context about the room, appended to prompts.
 *
 * The mood is inferred from what the room has actually been doing (see
 * MOODS in protocol.mjs), so handing it to the DJ is the difference between a
 * host who reads the room and one who reads a track listing.
 */
function roomContext(mood) {
  return mood ? `The room's mood right now is "${mood.label}" (${mood.why}).` : "";
}

/** Short spoken-style intro for a track. Returns null on any failure. */
export async function generateIntro(track, { mood } = {}) {
  try {
    const persona = activePersona();
    const { text } = await generateText({
      model: getModel(),
      system: persona.prompt,
      prompt: [
        `Introduce this track for the room in your voice, max 2 short sentences, no quotes:`,
        `"${track.title}" by ${track.artist}.`,
        roomContext(mood),
      ]
        .filter(Boolean)
        .join("\n"),
      maxTokens: 80,
    });
    return text.trim().slice(0, 300);
  } catch {
    return null;
  }
}

/** Interpret a chat request into a search query, or null if it isn't one. */
export async function interpretRequest(message, { mood } = {}) {
  try {
    const { text } = await generateText({
      model: getModel(),
      system:
        "You turn a listener's chat message into a YouTube Music search query for ONE song or vibe. Reply with ONLY the query, nothing else. If the message is not a music request, reply with exactly NONE. If the listener names a specific song or artist, use it verbatim — never substitute your own taste for an explicit request.",
      prompt: [message, roomContext(mood)].filter(Boolean).join("\n\n"),
      maxTokens: 30,
    });
    const q = text.trim().replace(/^["']|["']$/g, "");
    if (!q || /^none$/i.test(q)) return null;
    return q.slice(0, 120);
  } catch {
    return null;
  }
}

/**
 * What the DJ would put on next.
 *
 * Returns plain search queries ("Artist – Title") rather than tracks, because
 * the LLM has no idea what is actually on YouTube Music; the caller resolves
 * each one through the normal search path and drops anything that doesn't
 * come back. That also means a hallucinated title costs a miss, not a bad
 * queue entry.
 *
 * Returns an empty array — never throws — when the DJ is off or unreachable,
 * which is the signal for the caller to fall back to plain artist search.
 *
 * @param {{
 *   seed?: { title: string, artist: string } | null,
 *   mood?: { label: string, why: string } | null,
 *   avoid?: string[],
 *   count?: number,
 * }} [options]
 * @returns {Promise<string[]>}
 */
export async function suggestTracks({ seed, mood, avoid = [], count = 5 } = {}) {
  if (!djEnabled()) return [];
  try {
    const persona = activePersona();
    const { text } = await generateText({
      model: getModel(),
      system: [
        persona.prompt,
        `When picking music you lean towards: ${persona.taste}.`,
        `You are choosing what the room hears next. Reply with exactly ${count} lines.`,
        `Each line must be "Artist - Song Title" and nothing else. No numbering, no commentary, no blank lines.`,
        `Only suggest real, released tracks you are confident exist.`,
      ].join(" "),
      prompt: [
        seed
          ? `The room is playing "${seed.title}" by ${seed.artist}. Suggest what follows it well.`
          : `The room has nothing playing yet. Suggest an opening set.`,
        roomContext(mood),
        avoid.length ? `Do not suggest any of these: ${avoid.slice(0, 20).join("; ")}.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      maxTokens: 200,
    });

    return text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 2 && l.length < 120)
      .slice(0, count);
  } catch {
    return [];
  }
}
