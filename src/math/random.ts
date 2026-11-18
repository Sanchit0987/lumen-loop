/** Small deterministic PRNG (mulberry32) so simulations and tests are reproducible. */
export interface Rng {
  next(): number;
  range(lo: number, hi: number): number;
  gaussian(sigma?: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

const UINT32 = 4294967296;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
  const gaussian = (sigma = 1): number => {
    const u = Math.max(next(), Number.EPSILON);
    const v = next();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    gaussian,
    chance: (p) => next() < p,
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],
  };
}
