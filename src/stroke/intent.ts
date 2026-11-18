import type { Vec3 } from '../math/vec3';

/** What a player (human or AI) wants a stroke to do, independent of how the face achieves it. */
export interface StrokeIntent {
  /** 0 = soft block, 1 = full swing. */
  power: number;
  /** -1 = heavy backspin chop, +1 = heavy topspin loop. */
  topspin: number;
  /** -1..1 sideways brush; positive curves the ball towards +X for player 0. */
  sidespin: number;
  /** Desired first bounce on the opponent's half (world space). */
  target: Vec3;
  /** Fraction of the incoming spin the player reads correctly (1 = perfect). */
  spinRead: number;
  isServe: boolean;
}

export interface SolvedStroke {
  /** Unit normal of the striking face. */
  normal: Vec3;
  /** Paddle velocity at contact. */
  velocity: Vec3;
  pitch: number;
  yaw: number;
  /** True when the solver believes the shot is legal. */
  legal: boolean;
  /** Believed landing point. */
  landing: Vec3 | null;
}
