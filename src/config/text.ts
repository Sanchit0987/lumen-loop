import type { PointReason } from '../rules/referee';

export const TITLE = 'LUMEN LOOP';
export const TAGLINE = 'Spin-true table tennis';

export const REASON_TEXT: Record<PointReason, string> = {
  winner: 'Clean winner',
  net: 'Into the net',
  out: 'Off the table',
  'own-side': 'Bounced on own side',
  'serve-fault': 'Service fault',
  missed: 'Hit before the bounce',
};

export const TEXT = {
  you: 'You',
  player1: 'Player 1',
  player2: 'Player 2',
  serveHint: 'Click or tap to serve \u2014 flick up as the ball drops for more pace',
  serveHintKeys: 'Press Enter to toss, then hold \u2193 to swing',
  let: 'Let \u2014 replay the serve',
  gamePoint: 'Game point',
  matchPoint: 'Match point',
  deuce: 'Deuce',
  replay: 'Match point replay',
  skip: 'Click to skip',
  paused: 'Paused',
  champion: 'Champion of the Lumen Open!',
} as const;

export const HOW_TO_PLAY: readonly [string, string][] = [
  ['Move', 'The paddle follows your mouse. On touch screens, drag anywhere. A gold ring shows where the ball will land.'],
  ['Serve', 'Click or tap to toss the ball. It is struck as it drops; flick up at that moment for a faster serve.'],
  ['Hit', 'Get the paddle near the ball and it will return it. Hold still for a soft block; flick the mouse up the screen to drive. The faster the flick, the harder the shot.'],
  ['Direction', 'Flick diagonally left or right to aim, which also adds sidespin.'],
  ['Topspin', 'Hold the left mouse button (or LOOP) while swinging for a dipping loop.'],
  ['Backspin', 'Hold the right mouse button (or CHOP) for a floating chop.'],
  ['Keyboard', 'P1: A/D move, W swing, Space toss, F loop, G chop. P2: \u2190/\u2192 move, \u2193 swing, Enter toss, . loop, , chop.'],
  ['Rules', 'Games to 11, win by 2. Two serves each, then one each from 10\u201310.'],
  ['Shortcuts', 'Esc or P pause \u00b7 M mute \u00b7 R restart match'],
];

/** Short label describing a stroke for the HUD. */
export function strokeLabel(power: number, topspin: number, sidespin: number, serve: boolean): string {
  const STRONG = 0.45;
  const SIDE = 0.3;
  const SOFT = 0.12;
  const HARD = 0.75;
  let name = serve ? 'Serve' : power < SOFT ? 'Block' : power > HARD ? 'Smash drive' : 'Drive';
  if (topspin > STRONG) name = serve ? 'Topspin serve' : power > HARD ? 'Power loop' : 'Topspin loop';
  else if (topspin < -STRONG) name = serve ? 'Backspin serve' : 'Backspin chop';
  else if (topspin < 0 && !serve) name = 'Push';
  return Math.abs(sidespin) > SIDE ? `${name} + sidespin` : name;
}
