import type { Vec3 } from '../math/vec3';
import type { Flight } from '../physics/flight';
import type { BallState, PlayerIndex } from '../physics/types';
import type { StrokeIntent } from '../stroke/intent';

export type SimPhase = 'serve' | 'toss' | 'rally' | 'pointOver' | 'matchOver';

/** Everything a controller may look at when deciding what to do this step. */
export interface ControlView {
  time: number;
  player: PlayerIndex;
  phase: SimPhase;
  server: PlayerIndex;
  ball: BallState;
  paddle: Vec3;
  paddleVelocity: Vec3;
  opponentPaddle: Vec3;
  /** Predicted flight of the ball since the last contact, and the sim time it was made. */
  prediction: Flight | null;
  predictionTime: number;
  /** Increments whenever a new prediction replaces the old one. */
  predictionId: number;
  /** Player who struck the ball last. */
  lastHitter: PlayerIndex;
  /** Whether the last prediction was made after the ball bounced (rather than off a paddle). */
  predictionAfterBounce: boolean;
  /** True once the ball has bounced on this player's half and they must return it. */
  awaiting: boolean;
  /** Seconds since the current phase began. */
  phaseTime: number;
}

export interface PaddleCommand {
  x: number;
  z: number;
  /** Request a serve toss this step. */
  toss: boolean;
}

export interface Controller {
  /** Paddle travel speed cap for this controller, m/s. */
  readonly paddleSpeed: number;
  update(view: ControlView, dt: number): PaddleCommand;
  /** Called at the instant of contact to decide what the stroke does. */
  strokeIntent(view: ControlView, ballAtContact: BallState): StrokeIntent;
  /** Called when a new point starts. */
  reset(): void;
}
