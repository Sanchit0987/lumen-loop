import { beforeAll, describe, expect, it } from 'vitest';
import { BALL } from '../../src/config/ball';
import { PHYSICS, SURFACES } from '../../src/config/physics';
import { NET_TOP, TABLE } from '../../src/config/table';
import { v3 } from '../../src/math/vec3';
import { predictFlight } from '../../src/physics/flight';
import { spinVector } from '../../src/physics/spin';
import type { BallState } from '../../src/physics/types';
import { PhysicsWorld, type ContactEvent, type PaddleBody } from '../../src/physics/world';

let world: PhysicsWorld;
beforeAll(async () => { world = await PhysicsWorld.create(); });

const idle: PaddleBody[] = [
  { player: 0, position: v3(0, 1, 3), velocity: v3(), canHit: false },
  { player: 1, position: v3(0, 1, -3), velocity: v3(), canHit: false },
];

function run(state: BallState, seconds: number, paddles = idle, stopOn?: ContactEvent['kind']) {
  world.setBall(state);
  const events: ContactEvent[] = [];
  for (let i = 0; i < seconds / PHYSICS.timestep; i++) {
    const e = world.step(paddles, () => ({ normal: v3(0, 0, -1), velocity: v3(0, 0, -3) }));
    events.push(...e);
    if (stopOn && e.some((c) => c.kind === stopOn)) break;
  }
  return { events, ball: world.getBall() };
}

describe('Rapier world', () => {
  it('matches the pure predictor through flight and a spinning bounce', () => {
    const v = v3(0.3, 1.2, -3.2);
    const state = { p: v3(-0.1, TABLE.surfaceHeight + 0.25, 1.3), v, w: spinVector(v, 140, 30) };
    const predicted = predictFlight(state, { maxBounces: 2 });
    const { events } = run(state, predicted.bounces[1].t + 0.05);
    const bounces = events.filter((e) => e.kind === 'table');
    expect(bounces.length).toBeGreaterThanOrEqual(2);
    for (const i of [0, 1]) {
      expect(bounces[i].point.x).toBeCloseTo(predicted.bounces[i].p.x, 1);
      expect(bounces[i].point.z).toBeCloseTo(predicted.bounces[i].p.z, 1);
    }
    expect(Math.abs(bounces[0].point.z - predicted.bounces[0].p.z)).toBeLessThan(0.02);
  });

  it('carries heavy spin beyond the rigid-body solver cap, and still matches the predictor', () => {
    const v = v3(0, 2.6, -8);
    const state = { p: v3(0, TABLE.surfaceHeight + 0.18, 1.5), v, w: spinVector(v, 450, 0) };
    const predicted = predictFlight(state, { maxBounces: 1 });
    const { events, ball } = run(state, predicted.bounces[0].t + 0.02, idle, 'table');
    expect(events[0]?.kind).toBe('table');
    expect(Math.abs(events[0].point.z - predicted.bounces[0].p.z)).toBeLessThan(0.03);
    expect(Math.hypot(ball.w.x, ball.w.y, ball.w.z)).toBeGreaterThan(250);
  });

  it('bounces with the full table restitution whatever the drop height (no solver braking)', () => {
    for (let i = 0; i < 40; i++) {
      const height = 0.05 + i * 0.0037;
      const { events, ball } = run({ p: v3(0, TABLE.surfaceHeight + BALL.radius + height, 0.6), v: v3(0, -2.4, -5), w: v3() }, 0.2, idle, 'table');
      const hit = events[0];
      expect(hit?.kind).toBe('table');
      // One step of gravity separates the reported impact speed from the measured rebound.
      expect(Math.abs(ball.v.y / hit.speed - SURFACES.table.restitution), `drop ${height}`).toBeLessThan(0.03);
    }
  });

  it('never tunnels through the net, even at smash speed', () => {
    for (const speed of [8, 20, 45, 90]) {
      const { events, ball } = run({ p: v3(0.2, NET_TOP - 0.06, 0.6), v: v3(0, 0, -speed), w: v3() }, 0.25, idle, 'net');
      expect(events.some((e) => e.kind === 'net'), `net hit at ${speed} m/s`).toBe(true);
      expect(ball.p.z).toBeGreaterThan(0);
    }
  });

  it('never tunnels through the table at high speed', () => {
    for (const speed of [10, 40, 90]) {
      const { events, ball } = run({ p: v3(0, TABLE.surfaceHeight + 0.5, 0.7), v: v3(0, -speed, 0), w: v3() }, 0.1, idle, 'table');
      expect(events[0]?.kind).toBe('table');
      expect(events[0]?.topFace).toBe(true);
      expect(ball.p.y).toBeGreaterThan(TABLE.surfaceHeight);
    }
  });

  it('a fast paddle sweeping through a fast ball always connects', () => {
    for (const [ballSpeed, paddleSpeed] of [[5, 3], [25, 10], [60, 11]]) {
      const paddles: PaddleBody[] = [{ player: 0, position: v3(0, 1, 1.6), velocity: v3(0, 0, -paddleSpeed), canHit: true }, idle[1]];
      world.setBall({ p: v3(0.05, 1, 1.0), v: v3(0, 0, ballSpeed), w: v3() });
      let hit: ContactEvent | undefined;
      for (let i = 0; i < 60 && !hit; i++) {
        paddles[0].position = v3(0, 1, paddles[0].position.z - paddleSpeed * PHYSICS.timestep);
        hit = world.step(paddles, () => ({ normal: v3(0, 0, -1), velocity: v3(0, 0, -paddleSpeed) })).find((e) => e.kind === 'paddle');
      }
      expect(hit, `paddle hit at ${ballSpeed} m/s`).toBeDefined();
      expect(world.getBall().v.z).toBeLessThan(0);
    }
  });

  it('a paddle that may not hit lets the ball through', () => {
    const paddles: PaddleBody[] = [{ player: 0, position: v3(0, 1, 1.6), velocity: v3(), canHit: false }, idle[1]];
    const { events } = run({ p: v3(0, 1, 1.0), v: v3(0, 0, 6), w: v3() }, 0.3, paddles);
    expect(events.some((e) => e.kind === 'paddle')).toBe(false);
  });

  it('the ball comes to rest on the floor without sinking', () => {
    const { ball } = run({ p: v3(2, 0.5, 2), v: v3(0.5, 0, 0), w: v3() }, 6);
    expect(ball.p.y).toBeGreaterThan(BALL.radius - 0.005);
    expect(ball.p.y).toBeLessThan(BALL.radius + 0.02);
  });

  it('reports table edge hits as not on the playing surface', () => {
    const { events } = run({ p: v3(0, TABLE.surfaceHeight - 0.005, 1.8), v: v3(0, 0, -6), w: v3() }, 0.2, idle, 'table');
    expect(events[0]?.kind).toBe('table');
    expect(events[0]?.topFace).toBe(false);
  });

  it('holds the ball still for the serve', () => {
    world.holdBall(v3(0, 1, 1.5));
    for (let i = 0; i < 120; i++) world.step(idle, () => null);
    expect(world.getBall().p.y).toBeCloseTo(1, 3);
  });
});
