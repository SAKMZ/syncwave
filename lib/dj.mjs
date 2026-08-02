// AI DJ — thin layer over the Vercel AI SDK. Swappable provider (openai /
// anthropic / google / ollama). Generates short between-track intros, interprets
// plain-language chat requests into a search query, and suggests what to play
// next. Every call is wrapped so a missing/unreachable LLM never breaks
// playback — the DJ just stays quiet and the room falls back to plain search.

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getSettings, activePersona } from "./settings.mjs";

function getModel() {
  const s = getSettings();
  if (s.llmProvider === "anthropic") {
    return createAnthropic({ apiKey: s.llmApiKey })(s.llmModel);
  }
  if (s.llmProvider === "google") {
    // Gemini, via a Google AI Studio key. The free tier is generous enough to
    // run a DJ for a room of friends indefinitely, which makes this the first
    // provider worth suggesting to someone who doesn't already pay for one.
    return createGoogleGenerativeAI({ apiKey: s.llmApiKey })(s.llmModel);
  }
  if (s.llmProvider === "ollama") {
    // Ollama exposes an OpenAI-compatible endpoint at /v1.
    const base = (s.llmBaseUrl || "http://localhost:11434").replace(/\/$/, "");
    return createOpenAI({ baseURL: `${base}/v1`, apiKey: "ollama" })(s.llmModel);
  }
  return createOpenAI({ apiKey: s.llmApiKey })(s.llmModel);
}

/**
 * Token ceilings, sized for models that think before they speak.
 *
 * These used to be 30/80/200 — snug fits for the handful of words each call
 * actually needs. On a reasoning model that is a trap: the budget covers the
 * model's internal thinking *and* its answer, so the thinking eats the whole
 * allowance and the reply comes back as an empty string with
 * `finishReason: "length"`. No error, no warning, nothing in a log. The DJ just
 * never says anything, on a correctly configured account.
 *
 * Measured on gemma-4-26b-a4b-it: a one-line search query came back empty at
 * 30 tokens and answered in five at 400. A persona-voiced intro was still
 * empty at 1024 and fine at 4096 — a longer system prompt gives the model more
 * to think about, so the ceiling has to clear the thinking, not the answer.
 *
 * So these are deliberately generous. Output length is governed where it
 * belongs: by telling the model how long to be, and by slicing what comes back.
 */
const LIMITS = {
  test: 1024,
  request: 2048,
  intro: 4096,
  suggest: 8192,
};

/**
 * The text, or null — and a log line either way when there wasn't any.
 *
 * An empty completion is a failure that doesn't throw: the request succeeded,
 * the model simply said nothing. Left unremarked it looks exactly like a DJ
 * with nothing to add, which is how a token ceiling that was too low went
 * unnoticed until someone asked why the DJ never spoke.
 */
function usableText(where, result) {
  const text = (result?.text ?? "").trim();
  if (text) return text;
  const s = getSettings();
  console.warn(
    `[dj] ${where} returned nothing (${s.llmProvider}/${s.llmModel}, finish: ${result?.finishReason})` +
      (result?.finishReason === "length"
        ? " — the model spent its whole token budget, most likely on reasoning."
        : "")
  );
  return null;
}

/**
 * Pull the useful sentence out of a provider error.
 *
 * The SDK wraps the HTTP body, so `e.message` is often a generic retry
 * summary while the thing you actually need — "unexpected model name format",
 * "quota exceeded", "API key not valid" — is JSON inside `responseBody`.
 */
export function djError(e) {
  let msg = e?.responseBody || e?.message || String(e);
  try {
    msg = JSON.parse(msg)?.error?.message || msg;
  } catch {
    /* not JSON — the message is already the message */
  }
  return String(msg).replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Say why the DJ went quiet.
 *
 * Every call site below returns null on failure so that a broken LLM can never
 * take playback down with it — which is right, but it also meant a wrong model
 * name and a DJ with nothing to say looked identical from the outside, in the
 * logs, and in /admin. Silence is a fine failure mode; an unexplained one is
 * not.
 */
function djFailed(where, e) {
  const s = getSettings();
  console.warn(`[dj] ${where} failed (${s.llmProvider}/${s.llmModel}): ${djError(e)}`);
}

export function djEnabled() {
  return getSettings().aiDjEnabled;
}

/**
 * One real call to the configured model, with the error left intact.
 *
 * Exists so /admin can answer "is this actually working" without waiting for a
 * track change and then guessing.
 */
export async function testDj() {
  const s = getSettings();
  const where = { provider: s.llmProvider, model: s.llmModel };
  try {
    // A system prompt, deliberately: every real DJ call uses one, and some
    // models accept a bare prompt while doing nothing useful with a system
    // instruction. A check that exercises an easier path than the feature is
    // a check that passes while the feature is broken.
    const { text, finishReason } = await generateText({
      model: getModel(),
      system: "You are being checked for connectivity. Answer in one word.",
      prompt: "Reply with the single word: OK",
      maxTokens: LIMITS.test,
      maxRetries: 0,
    });

    const reply = text.trim();
    if (!reply) {
      // The call succeeded and the model said nothing — which is what a
      // reasoning model does when it spends its whole budget thinking.
      return {
        ...where,
        ok: false,
        error:
          finishReason === "length"
            ? "The model used its entire token budget without answering — typical of a reasoning model. Try a smaller or non-thinking model."
            : "The model connected but returned an empty reply.",
      };
    }
    return { ...where, ok: true, reply: reply.slice(0, 60) };
  } catch (e) {
    return { ...where, ok: false, error: djError(e) };
  }
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
    const res = await generateText({
      model: getModel(),
      system: persona.prompt,
      prompt: [
        `Introduce this track for the room in your voice, max 2 short sentences, no quotes:`,
        `"${track.title}" by ${track.artist}.`,
        roomContext(mood),
      ]
        .filter(Boolean)
        .join("\n"),
      maxTokens: LIMITS.intro,
    });
    const text = usableText("intro", res);
    return text && text.slice(0, 300);
  } catch (e) {
    djFailed("intro", e);
    return null;
  }
}

/** Interpret a chat request into a search query, or null if it isn't one. */
export async function interpretRequest(message, { mood } = {}) {
  try {
    const res = await generateText({
      model: getModel(),
      system:
        "You turn a listener's chat message into a YouTube Music search query for ONE song or vibe. Reply with ONLY the query, nothing else. If the message is not a music request, reply with exactly NONE. If the listener names a specific song or artist, use it verbatim — never substitute your own taste for an explicit request.",
      prompt: [message, roomContext(mood)].filter(Boolean).join("\n\n"),
      maxTokens: LIMITS.request,
    });
    const text = usableText("request", res);
    if (!text) return null;
    const q = text.replace(/^["']|["']$/g, "");
    if (!q || /^none$/i.test(q)) return null;
    return q.slice(0, 120);
  } catch (e) {
    djFailed("request", e);
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
    const res = await generateText({
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
      maxTokens: LIMITS.suggest,
    });

    const text = usableText("suggest", res);
    if (!text) return [];
    return text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 2 && l.length < 120)
      .slice(0, count);
  } catch (e) {
    djFailed("suggest", e);
    return [];
  }
}
