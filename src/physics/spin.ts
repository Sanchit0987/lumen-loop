import { cross, dot, normalize, v3, UP, type Vec3 } from '../math/vec3';

const horizontal = (v: Vec3): Vec3 => normalize(v3(v.x, 0, v.z), v3(0, 0, -1));

/** Axis about which positive rotation is topspin for a ball travelling along `travel`. */
export const topspinAxis = (travel: Vec3): Vec3 => cross(UP, horizontal(travel));

/** Build an angular velocity from signed topspin and sidespin rates (rad/s). */
export function spinVector(travel: Vec3, topspin: number, sidespin: number): Vec3 {
  const axis = topspinAxis(travel);
  return v3(axis.x * topspin, sidespin, axis.z * topspin);
}

/** Signed topspin rate (rad/s): positive dips the ball, negative (backspin) floats it. */
export const topspinOf = (w: Vec3, travel: Vec3): number => dot(w, topspinAxis(travel));

/** Signed sidespin rate about the vertical axis (rad/s). */
export const sidespinOf = (w: Vec3): number => w.y;
