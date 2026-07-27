// Proxy pool for yt-dlp.
//
// YouTube bot-checks datacenter IPs, but not uniformly. Measured on a fresh
// Oracle Cloud instance: every direct attempt was refused, while 4 of 10
// proxies from the same commodity provider fetched the same track fine. So the
// useful fix is not "route through a proxy" — it is "try proxies until one
// answers, and remember which ones did", because the working set is stable for
// a while and re-discovering it on every track wastes both time and bandwidth.
//
// Nothing here runs unless a proxy source is configured, so a home install is
// completely unaffected.

const LIST_TTL_MS = 60 * 60 * 1000; // re-ask the provider hourly
const COOLDOWN_MS = 30 * 60 * 1000; // how long a refused proxy sits out

let listCache = { at: 0, urls: [] };
/** url -> { until: number, fails: number } — only refusals are recorded. */
const penalties = new Map();
/** Proxies that have actually delivered a track, most recent first. */
const proven = new Set();

/** Webshare hands back host/port/user/pass separately; yt-dlp wants one URL. */
async function fetchWebshare(key) {
  const url = new URL("https://proxy.webshare.io/api/v2/proxy/list/");
  url.searchParams.set("mode", "direct");
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "100");

  const res = await fetch(url, {
    headers: { Authorization: `Token ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Webshare API returned ${res.status}`);

  const body = await res.json();
  return (body.results || [])
    .filter((p) => p.valid)
    .map((p) => {
      const auth = `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}`;
      return `http://${auth}@${p.proxy_address}:${p.port}`;
    });
}

/** Every configured proxy, unordered. Cached — this is called per download. */
async function allProxies() {
  const explicit = (process.env.YTDLP_PROXY_LIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;

  const key = process.env.WEBSHARE_API_KEY?.trim();
  if (!key) return [];

  if (Date.now() - listCache.at < LIST_TTL_MS && listCache.urls.length) {
    return listCache.urls;
  }
  try {
    const urls = await fetchWebshare(key);
    listCache = { at: Date.now(), urls };
    console.log(`[proxies] ${urls.length} available from Webshare`);
    return urls;
  } catch (e) {
    // Keep serving the previous list rather than losing playback because the
    // provider's API had a bad minute.
    console.warn(`[proxies] could not refresh list: ${e.message}`);
    return listCache.urls;
  }
}

/** True when any proxy source is configured. */
export function proxiesConfigured() {
  return Boolean(
    process.env.YTDLP_PROXY_LIST?.trim() ||
      process.env.WEBSHARE_API_KEY?.trim() ||
      process.env.YTDLP_PROXY?.trim()
  );
}

/**
 * Proxies to try, best first: ones that have worked before, then untried ones,
 * then any whose cooldown has expired. Capped, because each failed attempt
 * costs a user several seconds of staring at a spinner.
 */
export async function orderedProxies(limit = 4) {
  const single = process.env.YTDLP_PROXY?.trim();
  const pool = await allProxies();
  if (!pool.length) return single ? [single] : [];

  const now = Date.now();
  const rank = (url) => {
    if (proven.has(url)) return 0;
    const p = penalties.get(url);
    if (!p) return 1;
    return p.until > now ? 3 : 2;
  };

  const ordered = [...pool].sort((a, b) => rank(a) - rank(b));
  // A proxy still inside its cooldown is a last resort, not a candidate, as
  // long as anything untried remains.
  const usable = ordered.filter((u) => rank(u) < 3);
  const candidates = usable.length ? usable : ordered;
  return (single ? [single, ...candidates.filter((u) => u !== single)] : candidates).slice(0, limit);
}

/** Record how a proxy behaved so the next track starts with a better guess. */
export function markProxy(url, ok) {
  if (!url) return;
  if (ok) {
    penalties.delete(url);
    proven.add(url);
    return;
  }
  proven.delete(url);
  const prev = penalties.get(url);
  const fails = (prev?.fails ?? 0) + 1;
  // Back off harder on repeat offenders, but never park one forever — the
  // provider recycles addresses and a blocked one can come back clean.
  penalties.set(url, { fails, until: Date.now() + COOLDOWN_MS * Math.min(fails, 4) });
}

/** Host:port only — the credentials must never reach a log line. */
export function redactProxy(url) {
  if (!url) return "direct";
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}`;
  } catch {
    return "proxy";
  }
}
