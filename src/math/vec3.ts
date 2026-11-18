export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const UP: Readonly<Vec3> = Object.freeze(v3(0, 1, 0));
export const ZERO: Readonly<Vec3> = Object.freeze(v3());

export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => v3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
export const copy = (a: Vec3): Vec3 => v3(a.x, a.y, a.z);

export function normalize(a: Vec3, fallback: Vec3 = UP): Vec3 {
  const l = length(a);
  return l > Number.EPSILON ? scale(a, 1 / l) : copy(fallback);
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
/** Frame-rate independent exponential approach factor for a given time constant. */
export const approach = (dt: number, timeConstant: number): number =>
  timeConstant <= 0 ? 1 : 1 - Math.exp(-dt / timeConstant);
