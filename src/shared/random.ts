// Tiny deterministic PRNG so a given seed always reproduces the same picture
// (this is what makes the "Share" links exact).

export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** float in [min,max) */
  range(min: number, max: number): number;
  /** integer in [min,max] inclusive */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
}

// mulberry32 — fast, good enough for visuals.
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** A fresh random 32-bit seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
