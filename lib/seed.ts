/**
 * Deterministic randomness from a string.
 *
 * Two places need "random-looking but identical everywhere": a track's
 * waveform, which must not reshuffle on every render, and a reaction burst,
 * which must look the same in every browser in the room. Seeding both from an
 * id they already share gets that for free — no extra bytes on the wire, and
 * the burst you see is the burst everyone else sees.
 */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
