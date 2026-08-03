// A small fixed-window rate limiter, in memory.
//
// This exists for one situation: an instance that is publicly reachable, where
// the people hitting it are strangers rather than the friends the room was
// made for. Everything here is deliberately generous — the goal is to stop one
// script from creating ten thousand rooms, not to police anybody's evening.

/** key -> { count, resetAt } */
const buckets = new Map();
let lastSweep = 0;

/**
 * The caller's address, or null when there is no way to tell.
 *
 * Next populates `x-forwarded-for` from the connection itself, so this is
 * answerable in every deployment — `::1` on a local machine, the LAN address
 * on a home network, and behind a reverse proxy the real client at the head of
 * the chain. Measured, not assumed.
 *
 * The one case worth knowing about: a household behind NAT reaching a public
 * instance shares a single address, so they share a bucket. That is why the
 * limits above this are set where a person never meets them.
 *
 * Null is still handled, because a deployment that strips the header would
 * otherwise put every visitor in one bucket — better to not limit at all than
 * to limit everyone together.
 *
 * @param {Request} req
 * @returns {string | null}
 */
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  // The header is a chain, "client, proxy1, proxy2" — the client is first.
  const first = fwd?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Count one request against `key`, and say whether it may proceed.
 *
 * @param {string} key       bucket identity, usually `${route}:${ip}`
 * @param {number} limit     requests allowed per window; 0 disables the limit
 * @param {number} windowMs  length of the window
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 *          `retryAfter` is in seconds, for the header of the same name.
 */
export function rateLimit(key, limit, windowMs) {
  if (!limit) return { ok: true, remaining: Infinity, retryAfter: 0 };

  const now = Date.now();

  // Expired buckets are only swept occasionally: this runs on a hot path, and
  // a full pass per request would cost more than the entries do.
  if (now - lastSweep > windowMs) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const ok = bucket.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}
