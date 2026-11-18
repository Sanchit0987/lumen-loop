import { AI, type AiProfile } from '../config/ai';
import { SERVE } from '../config/paddle';
import { TABLE_HALF_LENGTH } from '../config/table';
import { length } from '../math/vec3';
import type { Rng } from '../math/random';
import type { BallState } from '../physics/types';
import type { Controller, ControlView, PaddleCommand } from '../sim/controller';
import type { StrokeIntent } from '../stroke/intent';
import { sideSign } from '../stroke/swing';
import { pickIntercept } from './intercept';
import { chooseServe, chooseShot, type ShotKind } from './shot';

interface Plan {
  x: number;
  z: number;
  /** Sim time at which the ball should reach the contact point. */
  time: number;
}

/** Computer opponent: predicts the ball, moves to meet it and chooses a stroke for the situation. */
export class AiController implements Controller {
  readonly paddleSpeed: number;
  lastShot: ShotKind | null = null;
  private plan: Plan | null = null;
  private seenPrediction = -1;
  private reactAt = 0;
  private errorX = 0;
  private errorZ = 0;
  private serveX = 0;
  private serveIntent: StrokeIntent | null = null;

  constructor(readonly profile: AiProfile, private readonly rng: Rng) {
    this.paddleSpeed = profile.paddleSpeed;
  }

  reset(): void {
    this.plan = null;
    this.seenPrediction = -1;
    this.serveIntent = null;
    this.serveX = this.rng.range(-AI.serveSpread, AI.serveSpread);
  }

  update(view: ControlView): PaddleCommand {
    const sign = sideSign(view.player);
    if (view.server === view.player && (view.phase === 'serve' || view.phase === 'toss')) return this.serve(view, sign);
    this.replan(view);
    const plan = this.plan;
    if (plan && view.time >= this.reactAt && view.phase === 'rally') {
      const swinging = plan.time - view.time <= AI.swingLead;
      const offset = swinging ? -AI.followThrough : AI.backswing;
      return { x: plan.x + this.errorX, z: plan.z + this.errorZ + sign * offset, toss: false };
    }
    const shadow = view.phase === 'rally' ? view.ball.p.x * AI.shadowBall : 0;
    return { x: shadow, z: sign * (TABLE_HALF_LENGTH + this.profile.standOff + AI.backswing), toss: false };
  }

  private replan(view: ControlView): void {
    if (view.predictionId === this.seenPrediction) return;
    this.seenPrediction = view.predictionId;
    const incoming = view.prediction && view.lastHitter !== view.player && view.phase === 'rally';
    const sample = incoming ? pickIntercept(view.prediction!, view.player, this.profile.standOff, view.predictionAfterBounce && view.awaiting) : null;
    if (!sample) { this.plan = null; return; }
    this.plan = { x: sample.p.x, z: sample.p.z, time: view.predictionTime + sample.t };
    const sigma = this.profile.positionError * (1 + AI.errorPerSpeed * length(view.ball.v));
    if (view.predictionAfterBounce) {
      this.errorX *= AI.postBounceError;
      this.errorZ *= AI.postBounceError;
    } else {
      this.reactAt = view.time + this.profile.reactionTime;
      this.errorX = this.rng.gaussian(sigma);
      this.errorZ = this.rng.gaussian(sigma);
    }
  }

  private serve(view: ControlView, sign: number): PaddleCommand {
    const homeZ = sign * (SERVE.minZ + AI.backswing);
    if (view.phase === 'serve') {
      return { x: this.serveX, z: homeZ, toss: view.phaseTime >= AI.serveDelay };
    }
    this.serveIntent ??= chooseServe(view.player, view.opponentPaddle.x, this.profile, this.rng).intent;
    const falling = view.ball.v.y < 0 && view.ball.p.y <= view.paddle.y + AI.serveStrikeHeight;
    return { x: this.serveX, z: falling ? homeZ - sign * (SERVE.holdForward + AI.followThrough) : homeZ, toss: false };
  }

  strokeIntent(view: ControlView, ball: BallState): StrokeIntent {
    if (view.phase === 'toss') {
      this.lastShot = 'serve';
      return this.serveIntent ?? chooseServe(view.player, view.opponentPaddle.x, this.profile, this.rng).intent;
    }
    const choice = chooseShot({ ball, player: view.player, opponentX: view.opponentPaddle.x, profile: this.profile, rng: this.rng });
    this.lastShot = choice.kind;
    return choice.intent;
  }
}

