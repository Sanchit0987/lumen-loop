import { AI, type AiProfile } from '../config/ai';
import { STROKE } from '../config/stroke';
import { TABLE, TABLE_HALF_LENGTH } from '../config/table';
import { clamp, clamp01, length, mix, v3 } from '../math/vec3';
import type { Rng } from '../math/random';
import { topspinOf } from '../physics/spin';
import type { BallState, PlayerIndex } from '../physics/types';
import type { StrokeIntent } from '../stroke/intent';
import { depthForPower, sideSign } from '../stroke/swing';

export type ShotKind = 'smash' | 'drive' | 'loop' | 'chop' | 'push' | 'serve';

export interface ShotContext {
  ball: BallState;
  player: PlayerIndex;
  /** Lateral position of the opponent's paddle. */
  opponentX: number;
  profile: AiProfile;
  rng: Rng;
}

export interface ShotChoice {
  kind: ShotKind;
  intent: StrokeIntent;
}

/** Picks the stroke type from ball height, depth and incoming spin, before any execution noise. */
export function classifyShot(ball: BallState, profile: AiProfile, rng: Rng): { kind: ShotKind; power: number; topspin: number } {
  const height = ball.p.y - TABLE.surfaceHeight;
  const incomingTopspin = topspinOf(ball.w, ball.v);
  const overTable = Math.abs(ball.p.z) < TABLE_HALF_LENGTH;
  const driveTopspin = mix(AI.driveTopspinMin, 1, clamp01(profile.loopBias));

  if (height > AI.smashHeight) {
    return { kind: 'smash', power: mix(AI.smashPowerMin, 1, profile.aggression), topspin: AI.smashTopspin };
  }
  if (incomingTopspin < -AI.heavyBackspin) {
    // Heavy backspin dives into the net unless it is lifted with a loop or pushed back.
    if (profile.loopBias > AI.looperThreshold && rng.chance(profile.aggression)) {
      return { kind: 'loop', power: AI.liftPower, topspin: 1 };
    }
    return { kind: 'push', power: AI.pushPower, topspin: AI.pushTopspin };
  }
  if (overTable && height < AI.lowBallHeight) {
    return { kind: 'push', power: AI.pushPower, topspin: AI.pushTopspin };
  }
  if (profile.loopBias < AI.chopperThreshold) {
    return { kind: 'chop', power: AI.chopPower, topspin: AI.chopTopspin };
  }
  // Soft, slow returns are an invitation: step in and hit them harder.
  const weak = length(ball.v) < AI.weakBallSpeed;
  const power = clamp01(profile.aggression + (weak ? AI.punishPower : 0));
  return { kind: driveTopspin > STROKE_LOOP_CUTOFF ? 'loop' : 'drive', power, topspin: driveTopspin };
}

/** Topspin fraction above which a drive is reported as a loop. */
const STROKE_LOOP_CUTOFF = (AI.driveTopspinMin + 1) / 2;

/** Lateral target: away from the opponent when the placement roll succeeds, otherwise anywhere. */
export function chooseTargetX(opponentX: number, profile: AiProfile, rng: Rng): number {
  const wide = STROKE.maxTargetX * profile.placementWidth;
  const options = [-wide, 0, wide];
  if (!rng.chance(profile.placementSkill)) return rng.pick(options);
  return options.reduce((best, x) => (Math.abs(x - opponentX) > Math.abs(best - opponentX) ? x : best));
}

/** Full shot decision: stroke type, placement and difficulty-scaled execution errors. */
export function chooseShot(ctx: ShotContext): ShotChoice {
  const { ball, player, profile, rng } = ctx;
  const shot = classifyShot(ball, profile, rng);
  const power = clamp01(shot.power + rng.gaussian(profile.powerError));
  const sign = sideSign(player);
  const depth = depthForPower(shot.kind === 'chop' ? 1 : power, false);
  // Scatter moves the target around the table but never off it: points are lost to misread spin,
  // late positioning and pace, not to deliberately aiming long.
  const x = clamp(chooseTargetX(ctx.opponentX, profile, rng) + rng.gaussian(profile.aimError), -STROKE.maxTargetX, STROKE.maxTargetX);
  const z = clamp(depth + rng.gaussian(profile.aimError), STROKE.minDepth, STROKE.maxDepth);
  const sidespin = shot.kind === 'push' || shot.kind === 'smash' ? 0 : profile.sidespin * (rng.chance(1 / 2) ? 1 : -1);
  return {
    kind: shot.kind,
    intent: {
      power,
      topspin: shot.topspin,
      sidespin,
      target: v3(x, 0, -sign * z),
      spinRead: clamp(profile.spinRead + rng.gaussian(profile.spinReadNoise), 0, AI.maxSpinRead),
      isServe: false,
    },
  };
}

/** Serve decision: varied length and spin, placed by the same rules as rally shots. */
export function chooseServe(player: PlayerIndex, opponentX: number, profile: AiProfile, rng: Rng): ShotChoice {
  const power = rng.range(AI.servePowerMin, mix(AI.servePowerMin, AI.servePowerMax, profile.aggression + 1 / 2));
  const spinSign = profile.loopBias < AI.chopperThreshold || rng.chance(1 / 2) ? -1 : 1;
  return {
    kind: 'serve',
    intent: {
      power: clamp01(power),
      topspin: spinSign * rng.range(1 / 4, 1) * mix(1 / 2, 1, clamp01(profile.spinRead)),
      sidespin: profile.sidespin * (rng.chance(1 / 2) ? 1 : -1),
      // Serve placement scatter stays on the table: a missed serve should be rare at any level.
      target: v3(
        clamp(chooseTargetX(opponentX, profile, rng) + rng.gaussian(profile.aimError), -STROKE.maxTargetX, STROKE.maxTargetX),
        0, -sideSign(player) * depthForPower(power, true),
      ),
      spinRead: 1,
      isServe: true,
    },
  };
}
