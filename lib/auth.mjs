// Admin auth for the setup console: a single password gate.
//
// The hash lives in its own `admin` store namespace, never in `settings` —
// settings are serialised to the browser, and this must not be. Sessions are
// stateless HMAC-signed cookies so there is no session table to persist.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { loadSync, saveNow } from "./store.mjs";
import { MIN_PASSWORD_LENGTH } from "./constants.mjs";

export const SESSION_COOKIE = "sw_admin";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const state = (globalThis.__SW_ADMIN ??= {
  passwordHash: "",
  salt: "",
  secret: "",
  createdAt: 0,
  ...loadSync("admin", {}),
});

/** False on a fresh instance — the app funnels to /setup until this is true. */
export function isSetupComplete() {
  return Boolean(state.passwordHash && state.salt && state.secret);
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function setAdminPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  state.salt = randomBytes(16).toString("hex");
  state.passwordHash = hashPassword(password, state.salt);
  // Rotating the secret would sign out every other session; only mint it once.
  if (!state.secret) state.secret = randomBytes(32).toString("hex");
  if (!state.createdAt) state.createdAt = Date.now();
  await saveNow("admin", state);
}

export function verifyPassword(password) {
  if (!isSetupComplete() || typeof password !== "string" || !password) return false;
  const given = Buffer.from(hashPassword(password, state.salt), "hex");
  const known = Buffer.from(state.passwordHash, "hex");
  return given.length === known.length && timingSafeEqual(given, known);
}

function sign(payload) {
  return createHmac("sha256", state.secret).update(payload).digest("base64url");
}

export function createSession() {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifySession(token) {
  if (!token || !state.secret) return false;
  const [exp, sig] = String(token).split(".");
  if (!exp || !sig) return false;
  const given = Buffer.from(sig);
  const known = Buffer.from(sign(exp));
  if (given.length !== known.length || !timingSafeEqual(given, known)) return false;
  return Number(exp) > Date.now();
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
