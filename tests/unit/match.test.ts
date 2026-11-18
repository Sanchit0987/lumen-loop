import { describe, expect, it } from 'vitest';
import { DIFFICULTY, type AiProfile } from '../../src/config/ai';
import { PHYSICS } from '../../src/config/physics';
import { RULES } from '../../src/config/rules';
import { createRng } from '../../src/math/random';
import { AiController } from '../../src/ai/controller';
import { PhysicsWorld } from '../../src/physics/world';
import { MatchSimulation } from '../../src/sim/match';

const MAX_SECONDS = 3600;

async function play(a: AiProfile, b: AiProfile, seed: number) {
  const world = await PhysicsWorld.create();
  const sim = new MatchSimulation(world, [new AiController(a, createRng(seed)), new AiController(b, createRng(seed + 1000))], { bestOf: 3, firstServer: 0 });
  let points: [number, number] = [0, 0];
  let strokes = 0, rallies = 0, serveFaults = 0, serves = 0;
  for (let i = 0; i < MAX_SECONDS / PHYSICS.timestep && sim.phase !== 'matchOver'; i++) {
    for (const e of sim.step()) {
      if (e.type === 'hit' && e.serve) serves++;
      if (e.type !== 'point') continue;
      points[e.winner]++;
      strokes += e.strokes;
      rallies++;
      if (e.reason === 'serve-fault') serveFaults++;
    }
  }
  world.dispose();
  return { sim, points, meanStrokes: strokes / rallies, faultRate: serveFaults / serves };
}

describe('headless AI match', () => {
  it('plays a full best-of-3 to a legal final score', async () => {
    const { sim } = await play(DIFFICULTY.normal, DIFFICULTY.normal, 21);
    expect(sim.phase).toBe('matchOver');
    expect(sim.score.winner).not.toBeNull();
    expect(Math.max(...sim.score.games)).toBe(2);
    for (const [a, b] of sim.score.history) {
      expect(Math.max(a, b)).toBeGreaterThanOrEqual(RULES.pointsToWinGame);
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(RULES.winMargin);
    }
  });

  it('is deterministic for a given seed', async () => {
    const a = await play(DIFFICULTY.easy, DIFFICULTY.hard, 5);
    const b = await play(DIFFICULTY.easy, DIFFICULTY.hard, 5);
    expect(a.sim.score.history).toEqual(b.sim.score.history);
    expect(a.sim.time).toBe(b.sim.time);
  });

  it('harder levels beat easier ones on points over several matches', async () => {
    const total = async (a: AiProfile, b: AiProfile) => {
      const sum: [number, number] = [0, 0];
      for (const seed of [1, 2, 3]) {
        const r = await play(a, b, seed);
        sum[0] += r.points[0];
        sum[1] += r.points[1];
      }
      return sum;
    };
    const [easy, hardVsEasy] = await total(DIFFICULTY.easy, DIFFICULTY.hard);
    const [normal, hardVsNormal] = await total(DIFFICULTY.normal, DIFFICULTY.hard);
    const [easy2, normalVsEasy] = await total(DIFFICULTY.easy, DIFFICULTY.normal);
    expect(hardVsEasy).toBeGreaterThan(easy * 2);
    expect(hardVsNormal).toBeGreaterThan(normal);
    expect(normalVsEasy).toBeGreaterThan(easy2);
  });

  it('produces real rallies and mostly legal serves', async () => {
    const hard = await play(DIFFICULTY.hard, DIFFICULTY.hard, 9);
    const easy = await play(DIFFICULTY.easy, DIFFICULTY.easy, 9);
    expect(hard.meanStrokes).toBeGreaterThan(3);
    expect(hard.meanStrokes).toBeGreaterThan(easy.meanStrokes);
    expect(hard.faultRate).toBeLessThan(0.2);
    expect(easy.faultRate).toBeLessThan(0.35);
  });
});
