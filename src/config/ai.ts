import { TABLE } from './table';

export interface AiProfile {
  id: string;
  name: string;
  tagline: string;
  /** Seconds before the AI starts moving after the opponent's stroke. */
  reactionTime: number;
  /** Paddle travel speed cap, m/s. */
  paddleSpeed: number;
  /** Standard deviation of the intercept misjudgement, metres (grows with ball speed). */
  positionError: number;
  /** Mean fraction of incoming spin that is read correctly, and its spread. */
  spinRead: number;
  spinReadNoise: number;
  /** Standard deviation of the landing target scatter, metres. */
  aimError: number;
  powerError: number;
  /** Base power of a neutral drive, 0..1. */
  aggression: number;
  /** -1 = chopper, +1 = looper. */
  loopBias: number;
  /** Probability of aiming away from the opponent rather than at random. */
  placementSkill: number;
  /** Fraction of the table half-width used for wide targets. */
  placementWidth: number;
  /** Sidespin magnitude mixed into drives and serves, 0..1. */
  sidespin: number;
  /** Preferred contact distance behind the end line, metres. */
  standOff: number;
  /** Accent colour of this opponent's robot, linear RGB. */
  colour: readonly [number, number, number];
}

export type Difficulty = 'easy' | 'normal' | 'hard';

const base = { placementWidth: 0.8, sidespin: 0.15, standOff: 0.28 };

export const DIFFICULTY: Record<Difficulty, AiProfile> = {
  easy: {
    ...base, id: 'easy', name: 'Dabble', tagline: 'Training partner',
    reactionTime: 0.3, paddleSpeed: 2.6, positionError: 0.05, spinRead: 0.72, spinReadNoise: 0.2,
    aimError: 0.2, powerError: 0.14, aggression: 0.26, loopBias: 0.1, placementSkill: 0.2,
    colour: [0.3, 0.75, 0.45],
  },
  normal: {
    ...base, id: 'normal', name: 'Rally', tagline: 'Club regular',
    reactionTime: 0.2, paddleSpeed: 3.8, positionError: 0.032, spinRead: 0.86, spinReadNoise: 0.12,
    aimError: 0.13, powerError: 0.09, aggression: 0.46, loopBias: 0.4, placementSkill: 0.55,
    colour: [0.95, 0.65, 0.15],
  },
  hard: {
    ...base, id: 'hard', name: 'Zenith', tagline: 'League champion',
    reactionTime: 0.12, paddleSpeed: 5.4, positionError: 0.018, spinRead: 0.96, spinReadNoise: 0.055,
    aimError: 0.07, powerError: 0.05, aggression: 0.66, loopBias: 0.6, placementSkill: 0.88,
    colour: [0.9, 0.2, 0.3],
  },
};

/** Tournament ladder: four opponents with distinct styles, in the order they are faced. */
export const TOURNAMENT: readonly AiProfile[] = [
  {
    ...DIFFICULTY.easy, id: 'brick', name: 'Brick', tagline: 'The Wall — blocks everything, attacks nothing',
    aggression: 0.16, loopBias: 0, positionError: 0.03, spinRead: 0.74, spinReadNoise: 0.2, aimError: 0.15,
    paddleSpeed: 3.2, placementSkill: 0.3, standOff: 0.12, colour: [0.35, 0.6, 0.9],
  },
  {
    ...DIFFICULTY.normal, id: 'sift', name: 'Sift', tagline: 'The Chopper — floats heavy backspin from deep',
    aggression: 0.4, loopBias: -0.9, standOff: 0.5, spinRead: 0.86, placementSkill: 0.5,
    colour: [0.55, 0.4, 0.9],
  },
  {
    ...DIFFICULTY.normal, id: 'whirl', name: 'Whirl', tagline: 'The Looper — topspin and sidespin on every ball',
    aggression: 0.6, loopBias: 1, sidespin: 0.55, standOff: 0.4, aimError: 0.11, spinRead: 0.84,
    paddleSpeed: 4.4, placementSkill: 0.65, colour: [0.95, 0.5, 0.1],
  },
  {
    ...DIFFICULTY.hard, id: 'apex', name: 'Apex', tagline: 'The Champion — fast, precise, relentless',
    aggression: 0.74, placementSkill: 0.95, placementWidth: 0.9, colour: [0.9, 0.15, 0.35],
  },
];

/** Shared decision thresholds for shot selection and movement. */
export const AI = {
  /** Ball height above the table from which the AI smashes. */
  smashHeight: 0.42,
  smashPowerMin: 0.78,
  smashTopspin: 0.2,
  /** A ball arriving slower than this (m/s) is a weak one: it is attacked with extra power. */
  weakBallSpeed: 5.2,
  punishPower: 0.3,
  /** Incoming backspin (rad/s) beyond which the ball is treated as heavy. */
  heavyBackspin: 55,
  /** Balls lower than this over the table are pushed rather than driven. */
  lowBallHeight: 0.16,
  pushPower: 0.14,
  pushTopspin: -0.55,
  liftPower: 0.5,
  chopPower: 0.36,
  chopTopspin: -0.9,
  driveTopspinMin: 0.25,
  /** A loopBias above this lifts heavy backspin with a loop instead of pushing it back. */
  looperThreshold: 0.3,
  /** A loopBias below this plays the chop defence on neutral balls. */
  chopperThreshold: -0.3,
  maxSpinRead: 1.12,
  /** Extra misjudgement per m/s of incoming ball speed. */
  errorPerSpeed: 0.09,
  /** Remaining misjudgement once the ball has bounced on the AI's side. */
  postBounceError: 0.5,
  /** Lowest and highest acceptable contact height above the table. */
  minContactHeight: 0.08,
  maxContactHeight: 0.62,
  lowContactPenalty: 4,
  /** Paddle waits this far behind the contact point, then swings through it. */
  backswing: 0.16,
  followThrough: 0.3,
  /** Seconds before contact at which the forward swing starts. */
  swingLead: 0.11,
  /** Ready position: fraction of the ball's lateral position the AI shadows. */
  shadowBall: 0.3,
  serveDelay: 1.0,
  serveSpread: 0.35,
  /** Height above the hand at which a tossed ball is struck on the way down. */
  serveStrikeHeight: 0.1,
  servePowerMin: 0.25,
  servePowerMax: 0.85,
  absoluteMinHeight: TABLE.surfaceHeight - 0.25,
} as const;
