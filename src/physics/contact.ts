import { BALL, BALL_INERTIA } from '../config/ball';
import { PHYSICS, type SurfaceParams } from '../config/physics';
import { add, addScaled, cross, dot, length, scale, sub, type Vec3 } from '../math/vec3';
import type { BallMotion } from './types';

/** Fraction of slip removed by a gripping contact for a hollow sphere: k / (1 + k). */
const GRIP_FACTOR = BALL.inertiaFactor / (1 + BALL.inertiaFactor);

/**
 * Impulse-based ball/surface impact with Coulomb friction, so the outcome depends on spin.
 *
 * `normal` is the unit surface normal pointing towards the ball; `surfaceVelocity` is the
 * velocity of the surface at the contact point (zero for the table, the swing for a paddle).
 * Returns the unchanged motion when the ball is already separating.
 */
export function resolveContact(
  v: Vec3,
  w: Vec3,
  normal: Vec3,
  surfaceVelocity: Vec3,
  surface: SurfaceParams,
): BallMotion {
  const rel = sub(v, surfaceVelocity);
  const vn = dot(rel, normal);
  if (vn >= 0) return { v, w };

  const arm = scale(normal, -BALL.radius);
  const pointVel = add(rel, cross(w, arm));
  const slip = addScaled(pointVel, normal, -dot(pointVel, normal));
  const slipSpeed = length(slip);

  const normalImpulse = -(1 + surface.restitution) * BALL.mass * vn;
  let tangentImpulse = scale(slip, 0);
  if (slipSpeed > PHYSICS.slipEpsilon) {
    const gripImpulse = (1 + surface.tangentialRestitution) * BALL.mass * GRIP_FACTOR * slipSpeed;
    const magnitude = Math.min(gripImpulse, surface.friction * normalImpulse);
    tangentImpulse = scale(slip, -magnitude / slipSpeed);
  }

  const impulse = addScaled(tangentImpulse, normal, normalImpulse);
  return {
    v: addScaled(v, impulse, 1 / BALL.mass),
    w: addScaled(w, cross(arm, tangentImpulse), 1 / BALL_INERTIA),
  };
}
