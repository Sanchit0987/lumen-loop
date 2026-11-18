import { pickIntercept } from '../ai/intercept';
import { INPUT } from '../config/input';
import { PADDLE } from '../config/paddle';
import { SWING } from '../config/stroke';
import { TABLE_HALF_LENGTH } from '../config/table';
import type { Rng } from '../math/random';
import { approach, length, scale, v3, type Vec3 } from '../math/vec3';
import type { FlightSample } from '../physics/flight';
import type { BallState } from '../physics/types';
import type { Controller, ControlView, PaddleCommand } from '../sim/controller';
import type { StrokeIntent } from '../stroke/intent';
import { sideSign, swingToIntent, type StrokeMode } from '../stroke/swing';

/** What an input device reports each step, in world metres on the player's own side. */
export interface InputSource {
  /** Desired paddle position: lateral x and signed world z. */
  target(view: ControlView, dt: number): { x: number; z: number };
  /** True once per toss request. */
  consumeToss(): boolean;
  mode(): StrokeMode;
  /** Swing velocity measured by the device itself, or null to derive it from target motion. */
  swing?(view: ControlView): Vec3 | null;
}

/**
 * Human player. The device says where the paddle should be and how fast the hand is swinging; this
 * controller adds the forgiving parts: it brings the paddle to a point where the ball can be met, pulls it onto
 * the ball's line, and judges the stroke by the hand's swing rather than the paddle's own travel.
 */
export class HumanController implements Controller {
  readonly paddleSpeed = PADDLE.humanSpeed;
  private swing: Vec3 = v3();
  private last: { x: number; z: number } | null = null;

  constructor(private readonly source: InputSource, private readonly rng: Rng) {}

  reset(): void {
    this.source.consumeToss();
    this.last = null;
  }

  update(view: ControlView, dt: number): PaddleCommand {
    const t = this.source.target(view, dt);
    this.trackSwing(view, t, dt);
    const sign = sideSign(view.player);
    const meet = this.meetingPoint(view, t.z * sign);
    const wantsToss = this.source.consumeToss();
    const toss = wantsToss && view.phase === 'serve' && view.server === view.player;
    if (!meet) return { x: t.x, z: t.z, toss };
    // Pull onto the ball's line, fully while the hand is close and not at all beyond the reach.
    const miss = meet.p.x - t.x;
    const core = INPUT.assistReach * INPUT.assistCore;
    const fade = Math.min(1, Math.max(0, (INPUT.assistReach - Math.abs(miss)) / (INPUT.assistReach - core)));
    return { x: t.x + miss * INPUT.assistStrength * fade, z: meet.p.z, toss };
  }

  /**
   * Where the paddle should wait for an incoming ball: the playable point of its predicted flight
   * nearest the depth the player chose, so short balls are reached and deep ones are not crowded.
   */
  private meetingPoint(view: ControlView, depth: number): FlightSample | null {
    if (view.phase !== 'rally' || view.lastHitter === view.player || !view.prediction) return null;
    return pickIntercept(view.prediction, view.player, depth - TABLE_HALF_LENGTH, view.predictionAfterBounce && view.awaiting);
  }

  private trackSwing(view: ControlView, t: { x: number; z: number }, dt: number): void {
    const measured = this.source.swing?.(view) ?? null;
    if (measured) {
      this.swing = measured;
    } else if (this.last) {
      let raw = v3((t.x - this.last.x) / dt, 0, (t.z - this.last.z) / dt);
      const speed = length(raw);
      if (speed > PADDLE.maxSpeed) raw = scale(raw, PADDLE.maxSpeed / speed);
      const k = approach(dt, PADDLE.velocitySmoothing);
      this.swing = v3(this.swing.x + (raw.x - this.swing.x) * k, 0, this.swing.z + (raw.z - this.swing.z) * k);
    }
    this.last = { x: t.x, z: t.z };
  }

  strokeIntent(view: ControlView, ball: BallState): StrokeIntent {
    const intent = swingToIntent(this.swing, ball, view.player, this.source.mode(), view.phase === 'toss');
    // Soft shots go exactly where they are aimed; the harder the swing, the less precise it is.
    const sigma = intent.isServe ? 0 : SWING.powerScatter * intent.power * intent.power;
    intent.target.x += this.rng.gaussian(sigma);
    intent.target.z += this.rng.gaussian(sigma);
    return intent;
  }
}
