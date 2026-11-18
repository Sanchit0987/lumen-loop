import { FLOW } from '../config/match';
import { PADDLE, SERVE } from '../config/paddle';
import { PHYSICS } from '../config/physics';
import type { BestOf } from '../config/rules';
import { ARENA } from '../config/table';
import { clamp, v3, type Vec3 } from '../math/vec3';
import { heightAtDepth } from '../ai/intercept';
import { predictFlight, type Flight } from '../physics/flight';
import { otherPlayer, type BallState, type PlayerIndex } from '../physics/types';
import type { ContactEvent, PhysicsWorld } from '../physics/world';
import { Rally, type Verdict } from '../rules/referee';
import { awardPoint, createMatch, currentServer, type MatchScore } from '../rules/scoring';
import { solveStroke } from '../stroke/solver';
import { sideSign } from '../stroke/swing';
import type { Controller, ControlView, SimPhase } from './controller';
import type { SimEvent } from './events';
import { createPaddle, movePaddle, type PaddleState } from './paddle';

export interface MatchOptions {
  bestOf: BestOf;
  firstServer: PlayerIndex;
}

const PLAYERS: readonly PlayerIndex[] = [0, 1];

/** Headless, deterministic match: physics, paddles, referee and scoring on a fixed timestep. */
export class MatchSimulation {
  readonly score: MatchScore;
  readonly paddles: [PaddleState, PaddleState] = [createPaddle(0), createPaddle(1)];
  phase: SimPhase = 'serve';
  time = 0;
  server: PlayerIndex;
  rally: Rally;
  ball: BallState;
  private phaseStart = 0;
  private pauseLength = 0;
  private lastContact = 0;
  private prediction: Flight | null = null;
  private predictionTime = 0;
  private predictionId = 0;
  private predictionAfterBounce = false;
  private events: SimEvent[] = [];

  constructor(
    private readonly world: PhysicsWorld,
    readonly controllers: readonly [Controller, Controller],
    options: MatchOptions,
  ) {
    this.score = createMatch(options.bestOf, options.firstServer);
    this.server = currentServer(this.score);
    this.rally = new Rally(this.server);
    this.ball = world.getBall();
    this.beginServe();
  }

  get phaseTime(): number {
    return this.time - this.phaseStart;
  }

  /** Advances the match by one fixed timestep and returns what happened in it. */
  step(): SimEvent[] {
    const dt = PHYSICS.timestep;
    this.events = [];
    this.time += dt;
    const views = PLAYERS.map((p) => this.view(p));
    for (const p of PLAYERS) {
      const command = this.controllers[p].update(views[p], dt);
      const holding = this.phase === 'serve' && this.server === p;
      movePaddle(this.paddles[p], {
        command, maxSpeed: this.controllers[p].paddleSpeed, holdingServe: holding, frozen: this.phase === 'toss' && this.server === p,
        targetHeight: this.heightFor(p),
      }, dt);
      if (holding && command.toss && this.phaseTime >= FLOW.serveMinDelay) this.toss();
    }
    if (this.phase === 'serve') this.world.holdBall(this.holdPoint());

    const bodies = PLAYERS.map((p) => ({
      player: p, position: this.paddles[p].position, velocity: this.paddles[p].velocity, canHit: this.canHit(p),
    }));
    const contacts = this.world.step(bodies, (player, ball) => this.strike(player, ball));
    this.ball = this.world.getBall();
    for (const c of contacts) this.onContact(c);
    this.checkFlow();
    return this.events;
  }

  /** Where the incoming ball will bounce on `p`'s half, while that bounce is still to come. */
  incomingBounce(p: PlayerIndex): Vec3 | null {
    if (this.phase !== 'rally' || this.rally.lastHitter === p || this.rally.awaiting === p || !this.prediction) return null;
    return this.prediction.bounces.find((b) => b.side === p)?.p ?? null;
  }

  private canHit(p: PlayerIndex): boolean {
    if (this.phase === 'toss') {
      return p === this.server && this.phaseTime >= FLOW.tossMinFlight && this.ball.v.y < 0;
    }
    return this.phase === 'rally' && this.rally.canHit(p);
  }

  private holdPoint(): Vec3 {
    const p = this.paddles[this.server].position;
    return v3(p.x, p.y + SERVE.holdUp, p.z - sideSign(this.server) * SERVE.holdForward);
  }

  private heightFor(p: PlayerIndex): number {
    const paddle = this.paddles[p];
    if (this.phase === 'toss' && this.server === p) return SERVE.paddleHeight;
    if (this.phase !== 'rally' || this.rally.lastHitter === p) return PADDLE.restHeight;
    // Once the ball has bounced on this side the hand tracks it directly, leading by its own lag.
    if (this.rally.awaiting === p) return this.ball.p.y + this.ball.v.y * PADDLE.heightFollowTime;
    const predicted = this.prediction ? heightAtDepth(this.prediction, p, paddle.position.z, false) : null;
    return predicted ?? Math.max(this.ball.p.y, PADDLE.restHeight);
  }

  private view(p: PlayerIndex): ControlView {
    const paddle = this.paddles[p];
    return {
      time: this.time, player: p, phase: this.phase, server: this.server, ball: this.ball,
      paddle: paddle.position, paddleVelocity: paddle.swing, opponentPaddle: this.paddles[otherPlayer(p)].position,
      prediction: this.prediction, predictionTime: this.predictionTime, predictionId: this.predictionId,
      lastHitter: this.rally.lastHitter, predictionAfterBounce: this.predictionAfterBounce,
      awaiting: this.rally.awaiting === p, phaseTime: this.phaseTime,
    };
  }

  private setPhase(phase: SimPhase): void {
    this.phase = phase;
    this.phaseStart = this.time;
  }

  private beginServe(): void {
    this.server = currentServer(this.score);
    this.rally = new Rally(this.server);
    this.prediction = null;
    this.predictionId++;
    for (const c of this.controllers) c.reset();
    this.setPhase('serve');
    this.world.holdBall(this.holdPoint());
    this.events.push({ type: 'serveReady', server: this.server });
  }

  private toss(): void {
    this.world.setBall({ p: this.holdPoint(), v: v3(0, SERVE.tossSpeed, 0), w: v3() });
    this.setPhase('toss');
    this.events.push({ type: 'toss', player: this.server });
  }

  private strike(player: PlayerIndex, ball: BallState) {
    const serve = this.phase === 'toss';
    const intent = this.controllers[player].strokeIntent(this.view(player), ball);
    const solved = solveStroke(ball, intent, player);
    const paddle = this.paddles[player];
    // The hit volume is larger than the blade; bring the blade onto the ball so contact looks true.
    paddle.position = v3(ball.p.x, clamp(ball.p.y, PADDLE.minHeight, PADDLE.maxHeight), paddle.position.z);
    paddle.targetNormal = solved.normal;
    paddle.faceHold = PADDLE.faceHoldTime;
    paddle.lastHitTime = this.time;
    paddle.lastHitPower = intent.power;
    this.pendingHit = { power: intent.power, topspin: intent.topspin, sidespin: intent.sidespin, serve, legal: solved.legal };
    return { normal: solved.normal, velocity: solved.velocity };
  }

  private pendingHit = { power: 0, topspin: 0, sidespin: 0, serve: false, legal: false };

  private onContact(c: ContactEvent): void {
    this.lastContact = this.time;
    let verdict: Verdict | null = null;
    if (c.kind === 'paddle' && c.player !== undefined) {
      if (this.phase === 'toss') this.setPhase('rally');
      verdict = this.rally.onPaddleHit(c.player);
      this.events.push({ type: 'hit', player: c.player, point: c.point, speed: c.speed, ...this.pendingHit });
      this.predict(false);
    } else if (c.kind === 'table' && c.topFace) {
      const side: PlayerIndex = c.point.z >= 0 ? 0 : 1;
      this.events.push({ type: 'bounce', point: c.point, speed: c.speed, side });
      if (this.phase === 'rally') {
        verdict = this.rally.onTableBounce(side);
        this.predict(true);
      }
    } else if (c.kind === 'net') {
      this.events.push({ type: 'net', point: c.point, speed: c.speed });
      if (this.phase === 'rally') {
        this.rally.onNet();
        this.predict(true);
      }
    } else {
      this.events.push({ type: c.kind === 'floor' ? 'floor' : 'edge', point: c.point, speed: c.speed });
      if (this.phase === 'rally') verdict = this.rally.onDead();
    }
    if (verdict) this.conclude(verdict);
  }

  private predict(afterBounce: boolean): void {
    this.prediction = predictFlight(this.ball, { record: true });
    this.predictionTime = this.time;
    this.predictionAfterBounce = afterBounce;
    this.predictionId++;
  }

  private checkFlow(): void {
    const b = this.ball.p;
    if (this.phase === 'toss' && b.y < this.paddles[this.server].position.y + SERVE.holdUp - SERVE.retryDrop) {
      this.beginServe();
    } else if (this.phase === 'rally') {
      const escaped = Math.abs(b.x) > ARENA.floorHalfSize || Math.abs(b.z) > ARENA.floorHalfSize || b.y < 0;
      if (escaped || this.time - this.lastContact > FLOW.deadBallTime) {
        const verdict = this.rally.onDead();
        if (verdict) this.conclude(verdict);
      }
    } else if (this.phase === 'pointOver' && this.phaseTime >= this.pauseLength) {
      if (this.score.winner !== null) this.setPhase('matchOver');
      else this.beginServe();
    }
  }

  private conclude(verdict: Verdict): void {
    this.setPhase('pointOver');
    if (verdict.type === 'let') {
      this.pauseLength = FLOW.letPause;
      this.events.push({ type: 'let' });
      return;
    }
    const result = awardPoint(this.score, verdict.winner);
    this.pauseLength = result.gameWonBy === null ? FLOW.pointPause : FLOW.gamePause;
    this.events.push({ type: 'point', winner: verdict.winner, reason: verdict.reason, strokes: this.rally.strokes, ...result });
  }
}
