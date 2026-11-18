import type { Vec3 } from './vec3';

export type Quat = [number, number, number, number];

export const identityQuat = (): Quat => [0, 0, 0, 1];

/** Rotates orientation `q` by angular velocity `w` (rad/s) over `dt` seconds. */
export function integrateSpin(q: Quat, w: Vec3, dt: number): Quat {
  const rate = Math.hypot(w.x, w.y, w.z);
  if (rate < Number.EPSILON) return q;
  const half = (rate * dt) / 2;
  const s = Math.sin(half) / rate;
  const [ax, ay, az, aw] = [w.x * s, w.y * s, w.z * s, Math.cos(half)];
  const [bx, by, bz, bw] = q;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
