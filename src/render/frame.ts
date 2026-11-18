import type { Vec3 } from '../math/vec3';

export interface PaddleFrame {
  position: Vec3;
  normal: Vec3;
  /** Smoothed paddle velocity, m/s. */
  swing: Vec3;
}

/** Everything the renderer needs to draw one instant of play (live or replayed). */
export interface Frame {
  ball: Vec3;
  /** Ball orientation quaternion [x, y, z, w], so the maker's mark shows the spin. */
  ballRotation: [number, number, number, number];
  ballSpeed: number;
  paddles: [PaddleFrame, PaddleFrame];
}
