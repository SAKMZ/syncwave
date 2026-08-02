"use client";

/**
 * Tint the room with the colours of whatever is playing.
 *
 * The cover is sampled once per track and reduced to two colours, published as
 * `--art-1` / `--art-2` on the document root. Everything ambient reads from
 * those: the aurora, the halo behind the artwork, the waveform, the progress
 * fill, the active queue row.
 *
 * Two rules keep this from becoming a light show. First, the extracted colours
 * are clamped into a narrow saturation and lightness band before they are
 * published — an album cover that is 90% pure red must not hand the UI pure
 * red, because every border and glow drawn from it would then fight the text
 * sitting on top. Second, anything that can't be sampled (a greyscale sleeve, a
 * cross-origin refusal, no artwork at all) falls back to the brand accent
 * rather than to whatever the last track left behind.
 */

import { useEffect } from "react";

const FALLBACK = ["#8b5cf6", "#ff4d8d"] as const;

/* --- colour space ------------------------------------------------------- */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[seg];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* --- extraction ---------------------------------------------------------- */

const BUCKETS = 18; // 20° of hue each
const SAMPLE = 32; // the cover is drawn this small before reading pixels

function dominantPair(data: Uint8ClampedArray): [string, string] | null {
  const weight = new Float64Array(BUCKETS);
  const satSum = new Float64Array(BUCKETS);
  const lumSum = new Float64Array(BUCKETS);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    // Near-black, near-white and unsaturated pixels say nothing about the
    // cover's identity, and a sleeve is often mostly one of the three.
    if (s < 0.15 || l < 0.12 || l > 0.92) continue;
    const b = Math.min(BUCKETS - 1, Math.floor(h / (360 / BUCKETS)));
    // Favour saturated midtones: they are what a person would call "the colour
    // of the cover", where the raw pixel count is usually a dark background.
    const w = s * (1 - Math.abs(l - 0.5) * 0.8);
    weight[b] += w;
    satSum[b] += s * w;
    lumSum[b] += l * w;
  }

  const order = Array.from({ length: BUCKETS }, (_, i) => i)
    .filter((i) => weight[i] > 0)
    .sort((a, b) => weight[b] - weight[a]);
  if (!order.length) return null;

  const toHex = (bucket: number, hueShift = 0) => {
    const w = weight[bucket];
    const hue = (bucket + 0.5) * (360 / BUCKETS) + hueShift;
    // The clamp that keeps this subtle. Whatever the cover actually is, what
    // the UI receives is a mid-saturation, mid-lightness version of its hue.
    const s = clamp(satSum[bucket] / w, 0.42, 0.82);
    const l = clamp(lumSum[bucket] / w, 0.46, 0.68);
    return hslToHex(hue, s, l);
  };

  const hueOf = (bucket: number) => (bucket + 0.5) * (360 / BUCKETS);
  const hueDist = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  const primary = order[0];
  // A second colour sitting a few degrees from the first reads as a rendering
  // artefact rather than a gradient, so require real separation before using
  // it — and when the cover genuinely is one hue, build the pair by rotating.
  const secondary = order.slice(1).find((b) => hueDist(hueOf(b), hueOf(primary)) >= 40);

  return [toHex(primary), secondary != null ? toHex(secondary) : toHex(primary, 38)];
}

/* --- hook ---------------------------------------------------------------- */

/**
 * @param src Cover art URL for the current track, or undefined when nothing is
 *            playing. Passing the same URL twice does no extra work.
 */
export function useArtworkTheme(src: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (a: string, b: string) => {
      root.style.setProperty("--art-1", a);
      root.style.setProperty("--art-2", b);
    };

    if (!src) {
      apply(FALLBACK[0], FALLBACK[1]);
      return;
    }

    let cancelled = false;
    const img = new Image();
    // Required to read pixels back out. Both art hosts (googleusercontent and
    // i.ytimg.com) allow it; if one ever stops, the catch below covers us.
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const pair = dominantPair(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data) ?? FALLBACK;
        if (!cancelled) apply(pair[0], pair[1]);
      } catch {
        // Tainted canvas — the cover loaded but can't be read. Keep the brand
        // colours rather than leaving the previous track's tint in place.
        if (!cancelled) apply(FALLBACK[0], FALLBACK[1]);
      }
    };
    img.onerror = () => {
      if (!cancelled) apply(FALLBACK[0], FALLBACK[1]);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);
}
