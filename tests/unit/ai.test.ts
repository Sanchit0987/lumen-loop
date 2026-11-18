import { describe, expect, it } from 'vitest';
import { AI, DIFFICULTY, TOURNAMENT } from '../../src/config/ai';
import { SURFACES } from '../../src/config/physics';
import { SOLVER, STROKE } from '../../src/config/stroke';
import { NET_TOP, TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../../src/config/table';
import { createRng } from '../../src/math/random';
import { v3 } from '../../src/math/vec3';
import { pickIntercept, playableSamples } from '../../src/ai/intercept';
import { chooseServe, chooseShot, chooseTargetX, classifyShot } from '../../src/ai/shot';
import { resolveContact } from '../../src/physics/contact';
import { predictFlight } from '../../src/physics/flight';
import { spinVector, topspinOf } from '../../src/physics/spin';
import type { BallState } from '../../src/physics/types';
import { solveStroke } from '../../src/stroke/solver';
import { swingToIntent } from '../../src/stroke/swing';

/** A ball arriving at player 1 (far side), travelling towards -Z. */
const incoming = (height: number, topspin = 0, z = -(TABLE_HALF_LENGTH + 0.2)): BallState => {
  const v = v3(0, 0.5, -4);
  return { p: v3(0.1, TABLE.surfaceHeight + height, z), v, w: spinVector(v, topspin, 0) };
};
const rng = () => createRng(7);

describe('shot classification', () => {
  it('smashes a high ball', () => {
    const s = classifyShot(incoming(AI.smashHeight + 0.1), DIFFICULTY.normal, rng());
    expect(s.kind).toBe('smash');
    expect(s.power).toBeGreaterThanOrEqual(AI.smashPowerMin);
  });

  it('pushes heavy backspin unless the player is an aggressive looper', () => {
    const heavy = incoming(0.25, -(AI.heavyBackspin + 40));
    expect(classifyShot(heavy, { ...DIFFICULTY.easy, loopBias: 0 }, rng()).kind).toBe('push');
    const looper = { ...DIFFICULTY.hard, loopBias: 1, aggression: 1 };
    const lift = classifyShot(heavy, looper, rng());
    expect(lift.kind).toBe('loop');
    expect(lift.topspin).toBe(1);
  });

  it('pushes a short low ball over the table', () => {
    expect(classifyShot(incoming(AI.lowBallHeight - 0.05, 0, -0.6), DIFFICULTY.hard, rng()).kind).toBe('push');
  });

  it('choppers chop and loopers loop a neutral ball', () => {
    const ball = incoming(0.25);
    const chop = classifyShot(ball, TOURNAMENT.find((p) => p.id === 'sift')!, rng());
    const loop = classifyShot(ball, TOURNAMENT.find((p) => p.id === 'whirl')!, rng());
    expect(chop.kind).toBe('chop');
    expect(chop.topspin).toBeLessThan(0);
    expect(loop.kind).toBe('loop');
    expect(loop.topspin).toBeGreaterThan(0.6);
  });

  it('attacks a slow, weak ball harder than a fast one', () => {
    const fast = incoming(0.25);
    fast.v = v3(0, 0.5, -8);
    const slow = incoming(0.25);
    slow.v = v3(0, 0.5, -3);
    expect(classifyShot(slow, DIFFICULTY.normal, rng()).power).toBeGreaterThan(classifyShot(fast, DIFFICULTY.normal, rng()).power + 0.2);
  });

  it('harder levels drive with more power', () => {
    const ball = incoming(0.25);
    ball.v = v3(0, 0.5, -8);
    const powers = (['easy', 'normal', 'hard'] as const).map((d) => classifyShot(ball, DIFFICULTY[d], rng()).power);
    expect(powers[0]).toBeLessThan(powers[1]);
    expect(powers[1]).toBeLessThan(powers[2]);
  });
});

describe('shot placement', () => {
  it('a skilled player aims away from the opponent', () => {
    const sure = { ...DIFFICULTY.hard, placementSkill: 1 };
    expect(chooseTargetX(0.6, sure, rng())).toBeLessThan(0);
    expect(chooseTargetX(-0.6, sure, rng())).toBeGreaterThan(0);
  });

  it('targets land on the opponent half, and scatter grows as difficulty drops', () => {
    const spread = (d: 'easy' | 'hard') => {
      const r = createRng(3);
      const profile = { ...DIFFICULTY[d], placementSkill: 1 };
      const xs = Array.from({ length: 300 }, () => chooseShot({ ball: incoming(0.25), player: 1, opponentX: 0.6, profile, rng: r }).intent.target);
      for (const t of xs) expect(t.z).toBeGreaterThan(0);
      const mean = xs.reduce((a, t) => a + t.x, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, t) => a + (t.x - mean) ** 2, 0) / xs.length);
    };
    expect(spread('easy')).toBeGreaterThan(spread('hard') * 1.8);
  });

  it('spin reading is worse and noisier on easy', () => {
    const reads = (d: 'easy' | 'hard') => {
      const r = createRng(5);
      return Array.from({ length: 300 }, () => chooseShot({ ball: incoming(0.25), player: 1, opponentX: 0, profile: DIFFICULTY[d], rng: r }).intent.spinRead);
    };
    const miss = (xs: number[]) => xs.reduce((a, x) => a + Math.abs(1 - x), 0) / xs.length;
    expect(miss(reads('easy'))).toBeGreaterThan(miss(reads('hard')) * 2);
  });

  it('serves target the opponent half inside the table', () => {
    const r = createRng(11);
    for (let i = 0; i < 100; i++) {
      const s = chooseServe(1, 0, DIFFICULTY.easy, r).intent;
      expect(s.isServe).toBe(true);
      expect(s.target.z).toBeGreaterThan(0);
      expect(Math.abs(s.target.x)).toBeLessThanOrEqual(STROKE.maxTargetX);
    }
  });
});

describe('trajectory prediction', () => {
  const flight = predictFlight({ p: v3(0, 1, 1.4), v: v3(0.5, 1.2, -5.5), w: v3() }, { record: true });

  it('only offers contact points after the bounce on the receiver half', () => {
    const bounce = flight.bounces.find((b) => b.side === 1)!;
    const samples = playableSamples(flight, 1, false);
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) expect(s.t).toBeGreaterThan(bounce.t);
    expect(playableSamples(flight, 0, false)).toEqual([]);
  });

  it('picks an intercept near the preferred depth at a hittable height', () => {
    const s = pickIntercept(flight, 1, DIFFICULTY.normal.standOff, false)!;
    expect(s).not.toBeNull();
    expect(-s.p.z).toBeGreaterThan(TABLE_HALF_LENGTH - 0.5);
    expect(s.p.y).toBeGreaterThan(TABLE.surfaceHeight);
  });
});

describe('stroke solver', () => {
  const land = (ball: BallState, intent: Parameters<typeof solveStroke>[1], hitter: 0 | 1) => {
    const s = solveStroke(ball, intent, hitter);
    const out = resolveContact(ball.v, ball.w, s.normal, s.velocity, SURFACES.paddle);
    return { s, out, flight: predictFlight({ p: ball.p, v: out.v, w: out.w }, { maxBounces: intent.isServe ? 2 : 1 }) };
  };
  const intent = (over: Partial<Parameters<typeof solveStroke>[1]>) =>
    ({ power: 0.5, topspin: 0.5, sidespin: 0, target: v3(0.4, 0, 0.9), spinRead: 1, isServe: false, ...over });

  it('lands a perfectly read ball on the chosen target, over the net', () => {
    for (const topspin of [-0.9, 0, 0.9]) for (const spin of [-120, 0, 120]) {
      const { s, flight } = land(incoming(0.2, spin), intent({ topspin }), 1);
      expect(s.legal).toBe(true);
      expect(Math.hypot(flight.bounces[0].p.x - 0.4, flight.bounces[0].p.z - 0.9)).toBeLessThan(SOLVER.acceptCost);
      expect(flight.netCrossY!).toBeGreaterThan(NET_TOP);
    }
  });

  it('topspin intent leaves topspin on the ball, backspin intent backspin', () => {
    const top = land(incoming(0.2), intent({ topspin: 1, power: 0.7 }), 1).out;
    const back = land(incoming(0.2), intent({ topspin: -0.9, power: 0.4 }), 1).out;
    expect(topspinOf(top.w, top.v)).toBeGreaterThan(80);
    expect(topspinOf(back.w, back.v)).toBeLessThan(-80);
  });

  it('more power means a faster ball', () => {
    const speed = (power: number) => Math.hypot(...Object.values(land(incoming(0.2), intent({ power, topspin: 0.3 }), 1).out.v));
    expect(speed(0.9)).toBeGreaterThan(speed(0.1) + 2);
  });

  it('misreading heavy backspin sends the ball into the net or short', () => {
    const ball = incoming(0.2, -160);
    const good = land(ball, intent({ topspin: 0.2, power: 0.3 }), 1).flight;
    const bad = land(ball, intent({ topspin: 0.2, power: 0.3, spinRead: 0 }), 1).flight;
    expect(good.bounces[0]?.p.z).toBeGreaterThan(0);
    const badLanding = bad.bounces[0]?.p.z ?? -1;
    expect(bad.netHit || badLanding < good.bounces[0].p.z - 0.15).toBe(true);
  });

  it('solves a legal serve: one bounce each side', () => {
    const toss: BallState = { p: v3(0.1, TABLE.surfaceHeight + 0.24, TABLE_HALF_LENGTH + 0.18), v: v3(0, -1.6, 0), w: v3() };
    for (const topspin of [-0.8, 0, 0.8]) {
      const { s, flight } = land(toss, intent({ isServe: true, topspin, target: v3(-0.3, 0, -0.8) }), 0);
      expect(s.legal).toBe(true);
      expect(flight.bounces[0].side).toBe(0);
      expect(flight.bounces[1].side).toBe(1);
      expect(Math.abs(flight.bounces[1].p.x)).toBeLessThan(TABLE_HALF_WIDTH);
    }
  });
});

describe('human swing mapping', () => {
  const ball = incoming(0.2, 0, TABLE_HALF_LENGTH + 0.2);

  it('swing speed sets power and depth', () => {
    const soft = swingToIntent(v3(0, 0, -1.5), ball, 0, 'auto', false);
    const hard = swingToIntent(v3(0, 0, -6), ball, 0, 'auto', false);
    expect(hard.power).toBeGreaterThan(soft.power);
    expect(-hard.target.z).toBeGreaterThan(-soft.target.z);
  });

  it('swing angle sets direction and sidespin', () => {
    const left = swingToIntent(v3(-3, 0, -3), ball, 0, 'auto', false);
    const right = swingToIntent(v3(3, 0, -3), ball, 0, 'auto', false);
    expect(left.target.x).toBeLessThan(right.target.x - 0.5);
    expect(left.sidespin * right.sidespin).toBeLessThan(0);
  });

  it('stroke mode sets topspin or backspin; auto goes from push to drive', () => {
    const v = v3(0, 0, -4);
    expect(swingToIntent(v, ball, 0, 'loop', false).topspin).toBeGreaterThan(0.7);
    expect(swingToIntent(v, ball, 0, 'chop', false).topspin).toBeLessThan(-0.7);
    expect(swingToIntent(v3(0, 0, -0.5), ball, 0, 'auto', false).topspin).toBeLessThan(0);
    expect(swingToIntent(v3(0, 0, -6), ball, 0, 'auto', false).topspin).toBeGreaterThan(0);
  });

  it('mirrors for the far-side player', () => {
    const i = swingToIntent(v3(0, 0, 4), incoming(0.2), 1, 'auto', false);
    expect(i.power).toBeGreaterThan(0.5);
    expect(i.target.z).toBeGreaterThan(0);
  });
});
