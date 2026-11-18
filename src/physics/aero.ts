import { AIR, DRAG_K, MAGNUS_K } from '../config/ball';
import { PHYSICS } from '../config/physics';
import { cross, length, v3, type Vec3 } from '../math/vec3';

/** Quadratic air drag acceleration, opposing velocity. */
export function dragAcceleration(v: Vec3): Vec3 {
  const k = -DRAG_K * length(v);
  return v3(v.x * k, v.y * k, v.z * k);
}

/** Magnus acceleration: perpendicular to both spin axis and velocity. */
export function magnusAcceleration(v: Vec3, w: Vec3): Vec3 {
  const c = cross(w, v);
  return v3(c.x * MAGNUS_K, c.y * MAGNUS_K, c.z * MAGNUS_K);
}

/** Drag plus Magnus, without gravity (this is what gets fed to Rapier as a force). */
export function aeroAcceleration(v: Vec3, w: Vec3): Vec3 {
  const d = dragAcceleration(v);
  const m = magnusAcceleration(v, w);
  return v3(d.x + m.x, d.y + m.y, d.z + m.z);
}

/** Total free-flight acceleration including gravity. */
export function flightAcceleration(v: Vec3, w: Vec3): Vec3 {
  const a = aeroAcceleration(v, w);
  a.y -= PHYSICS.gravity;
  return a;
}

/** Multiplier applied to spin over one interval of length dt. */
export const spinDecay = (dt: number): number => Math.exp(-dt / AIR.spinDecayTime);
