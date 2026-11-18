import { AiController } from '../ai/controller';
import { DIFFICULTY, TOURNAMENT, type AiProfile, type Difficulty } from '../config/ai';
import type { BestOf } from '../config/rules';
import { TEXT } from '../config/text';
import { HumanController, type InputSource } from '../input/human';
import { createRng } from '../math/random';
import type { PlayerIndex } from '../physics/types';
import type { PhysicsWorld } from '../physics/world';
import type { Controller } from '../sim/controller';
import { MatchSimulation } from '../sim/match';

export type Mode =
  | { kind: 'quick'; difficulty: Difficulty }
  | { kind: 'tournament'; round: number }
  | { kind: 'versus' }
  | { kind: 'attract' };

export interface Session {
  mode: Mode;
  sim: MatchSimulation;
  names: [string, string];
  tints: [readonly [number, number, number], readonly [number, number, number]];
  /** Which players are humans. */
  humans: [boolean, boolean];
  opponent: AiProfile | null;
}

export interface SessionInputs {
  near: InputSource;
  far: InputSource;
}

const PLAYER_TINT: readonly [number, number, number] = [0.95, 0.72, 0.12];
const RIVAL_TINT: readonly [number, number, number] = [0.2, 0.55, 0.9];
const SEED_STRIDE = 7919;

export const tournamentOpponent = (round: number): AiProfile => TOURNAMENT[Math.min(round, TOURNAMENT.length - 1)];
export const isFinalRound = (round: number): boolean => round >= TOURNAMENT.length - 1;

/** Builds a match for a mode. `autoplay` lets an AI stand in for the near-side human (demos, tests). */
export function createSession(
  world: PhysicsWorld, mode: Mode, bestOf: BestOf, inputs: SessionInputs, seed: number, autoplay: boolean,
): Session {
  const ai = (profile: AiProfile, offset: number): Controller => new AiController(profile, createRng(seed + offset * SEED_STRIDE));
  const firstServer: PlayerIndex = createRng(seed).chance(1 / 2) ? 0 : 1;
  const near = (): Controller => (autoplay ? ai(DIFFICULTY.hard, 1) : new HumanController(inputs.near, createRng(seed + SEED_STRIDE)));
  let controllers: [Controller, Controller];
  let names: [string, string];
  let opponent: AiProfile | null = null;
  let humans: [boolean, boolean] = [!autoplay, false];

  if (mode.kind === 'versus') {
    controllers = [near(), new HumanController(inputs.far, createRng(seed - SEED_STRIDE))];
    names = [TEXT.player1, TEXT.player2];
    humans = [!autoplay, true];
  } else if (mode.kind === 'attract') {
    controllers = [ai(DIFFICULTY.hard, 1), ai(DIFFICULTY.hard, 2)];
    names = [DIFFICULTY.hard.name, DIFFICULTY.normal.name];
    humans = [false, false];
  } else {
    opponent = mode.kind === 'quick' ? DIFFICULTY[mode.difficulty] : tournamentOpponent(mode.round);
    controllers = [near(), ai(opponent, 2)];
    names = [TEXT.you, opponent.name];
  }
  return {
    mode, names, humans, opponent,
    sim: new MatchSimulation(world, controllers, { bestOf, firstServer }),
    tints: [PLAYER_TINT, opponent?.colour ?? RIVAL_TINT],
  };
}
