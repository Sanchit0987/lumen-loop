import type { Vec3 } from '../math/vec3';

/** Position, linear velocity and angular velocity (rad/s) of the ball. */
export interface BallState {
  p: Vec3;
  v: Vec3;
  w: Vec3;
}

export interface BallMotion {
  v: Vec3;
  w: Vec3;
}

export type PlayerIndex = 0 | 1;
export const otherPlayer = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);
/** Player 0 owns the +Z half of the table, player 1 the -Z half. */
export const sideOfZ = (z: number): PlayerIndex => (z >= 0 ? 0 : 1);
