import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/config/ai';
import { PADDLE } from '../../src/config/paddle';
import { PHYSICS } from '../../src/config/physics';
import { AiController } from '../../src/ai/controller';
import { HumanController, type InputSource } from '../../src/input/human';
import { createRng } from '../../src/math/random';
import { PhysicsWorld } from '../../src/physics/world';
import type { ControlView } from '../../src/sim/controller';
import { MatchSimulation } from '../../src/sim/match';
import type { StrokeMode } from '../../src/stroke/swing';

/**
 * A crude stand-in for a person with a mouse: follows the ball sideways with a lag, waits at the
 * back, and flicks forward when the ball gets close. No prediction, no aiming.
 */
class ScriptedHand implements InputSource {
  private x = 0;
  private wantsToss = false;
  private flick = 0;
  constructor(private readonly style: StrokeMode, private readonly swingDistance: number, private readonly flickSpeed: number) {}

  target(view: ControlView, dt: number): { x: number; z: number } {
    this.x += (view.ball.p.x - this.x) * Math.min(1, dt / 0.12);
    if (view.phase === 'serve') {
      this.wantsToss = view.phaseTime > 0.6;
      return { x: 0, z: PADDLE.maxZ };
    }
    if (view.phase === 'toss') {
      this.flick = view.ball.v.y < 0 ? this.flickSpeed : 0;
      return { x: 0, z: PADDLE.maxZ };
    }
    const incoming = view.phase === 'rally' && view.lastHitter !== view.player && view.ball.v.z > 0;
    this.flick = incoming && view.paddle.z - view.ball.p.z < this.swingDistance ? this.flickSpeed : 0;
    return { x: this.x, z: PADDLE.restZ };
  }

  /** Like the pointer, the hand reports its own swing speed (towards the net is -Z). */
  swing(): { x: number; y: number; z: number } {
    return { x: 0, y: 0, z: -this.flick };
  }

  consumeToss(): boolean {
    const t = this.wantsToss;
    this.wantsToss = false;
    return t;
  }

  mode(): StrokeMode {
    return this.style;
  }
}

async function play(style: StrokeMode, flickSpeed: number, level: 'easy' | 'normal' | 'hard' = 'easy', maxSeconds = 300, swingDistance = 0.55) {
  const world = await PhysicsWorld.create();
  const human = new HumanController(new ScriptedHand(style, swingDistance, flickSpeed), createRng(11));
  const sim = new MatchSimulation(world, [human, new AiController(DIFFICULTY[level], createRng(3))], { bestOf: 3, firstServer: 0 });
  const stats = { serves: 0, serveFaults: 0, returns: 0, chances: 0, illegal: 0, aiHits: 0, aiIllegal: 0, aiIn: 0, points: [0, 0], why: {} as Record<string, number> };
  let aiStruck = false;
  for (let i = 0; i < maxSeconds / PHYSICS.timestep && sim.phase !== 'matchOver'; i++) {
    const before = sim.ball;
    for (const e of sim.step()) {
      if (e.type === 'hit') aiStruck = e.player === 1;
      if (e.type === 'hit' && e.player === 0) {
        if (e.serve) stats.serves++;
        else stats.returns++;
      }
      if (e.type === 'bounce' && e.side === 0 && aiStruck) { stats.chances++; aiStruck = false; }
      if (e.type === 'hit' && e.player === 0 && !e.legal) stats.illegal++;
      if (e.type === 'hit' && e.player === 1 && !e.serve) { stats.aiHits++; if (!e.legal) stats.aiIllegal++; stats.aiIn = Math.max(stats.aiIn, Math.hypot(before.v.x, before.v.y, before.v.z)); }
      if (e.type === 'point') {
        const key = `${e.winner === 0 ? 'won' : 'lost'}:${e.reason}:${sim.rally.lastHitter === 0 ? 'myShot' : 'theirShot'}`;
        stats.why[key] = (stats.why[key] ?? 0) + 1;
        stats.points[e.winner]++;
        if (e.reason === 'serve-fault' && sim.rally.server === 0) stats.serveFaults++;
      }
    }
  }
  world.dispose();
  return stats;
}

describe('human swing control (scripted hand)', () => {
  it('a hand that follows the ball and flicks at it beats Easy', async () => {
    const s = await play('auto', 4);
    expect(s.serves).toBeGreaterThan(5);
    expect(s.serveFaults / s.serves).toBeLessThan(0.2);
    expect(s.returns / s.chances).toBeGreaterThan(0.75);
    expect(s.points[0]).toBeGreaterThan(s.points[1]);
  });

  it('a hand that never swings still serves and blocks the ball back', async () => {
    const s = await play('auto', 0);
    expect(s.serves).toBeGreaterThan(0);
    expect(s.serveFaults / s.serves).toBeLessThan(0.2);
    expect(s.returns / s.chances).toBeGreaterThan(0.75);
  });

  it('the same hands keep the ball in play against Normal and Hard', async () => {
    for (const level of ['normal', 'hard'] as const) for (const flick of [0, 4]) {
      const s = await play('auto', flick, level, 120);
      expect(s.returns / s.chances).toBeGreaterThan(0.6);
    }
  });

  it('loop and chop styles are also playable', async () => {
    for (const style of ['loop', 'chop'] as const) {
      const s = await play(style, 4);
      expect(s.returns / s.chances).toBeGreaterThan(0.7);
      expect(s.points[0]).toBeGreaterThan(8);
    }
  });
});
