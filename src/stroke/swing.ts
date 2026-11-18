import { STROKE, SWING } from '../config/stroke';
import { clamp, clamp01, mix, smoothstep, v3, type Vec3 } from '../math/vec3';
import type { BallState, PlayerIndex } from '../physics/types';
import type { StrokeIntent } from './intent';

export type StrokeMode = 'auto' | 'loop' | 'chop';

/** Sign of a player's own half along Z. */
export const sideSign = (player: PlayerIndex): number => (player === 0 ? 1 : -1);

/** Landing depth for a power level, measured from the net on the opponent's half. */
export function depthForPower(power: number, isServe: boolean): number {
  const short = isServe ? STROKE.serveShortDepth : STROKE.shortDepth;
  const deep = isServe ? STROKE.serveDeepDepth : STROKE.deepDepth;
  return clamp(mix(short, deep, power), STROKE.minDepth, STROKE.maxDepth);
}

/**
 * Converts a human swing into stroke intent: forward speed sets power (and, in auto mode, whether
 * the stroke is a backspin push or a topspin drive), swing angle sets direction and sidespin.
 */
export function swingToIntent(
  paddleVelocity: Vec3,
  ball: BallState,
  player: PlayerIndex,
  mode: StrokeMode,
  isServe: boolean,
): StrokeIntent {
  const sign = sideSign(player);
  const forward = -paddleVelocity.z * sign;
  const swung = clamp01((forward - SWING.blockSpeed) / (SWING.fullPowerSpeed - SWING.blockSpeed));
  const power = mix(SWING.minPower, 1, swung);
  const rawAngle = Math.atan2(paddleVelocity.x, Math.max(forward, SWING.angleFloorSpeed));
  const angle = clamp(rawAngle, -SWING.maxAngle, SWING.maxAngle) / SWING.maxAngle;

  let topspin: number;
  if (mode === 'loop') topspin = SWING.loopTopspinBase + SWING.loopTopspinGain * power;
  else if (mode === 'chop') topspin = SWING.chopBackspin;
  else if (isServe) topspin = mix(SWING.autoBackspin, SWING.serveTopspin, smoothstep(power));
  else topspin = mix(SWING.autoBackspin, SWING.autoTopspin, smoothstep(power));

  const x = clamp(ball.p.x * SWING.crossCarry + angle * SWING.aimReach, -STROKE.maxTargetX, STROKE.maxTargetX);
  return {
    power,
    topspin,
    sidespin: clamp(-sign * angle * SWING.sidespinGain, -1, 1),
    target: v3(x, 0, -sign * depthForPower(power, isServe)),
    spinRead: SWING.spinRead,
    isServe,
  };
}
