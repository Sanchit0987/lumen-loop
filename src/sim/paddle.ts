import { PADDLE, SERVE } from '../config/paddle';
import { TABLE, TABLE_HALF_LENGTH } from '../config/table';
import { approach, clamp, lerp, mix, normalize, v3, type Vec3 } from '../math/vec3';
import type { PlayerIndex } from '../physics/types';
import { sideSign } from '../stroke/swing';
import type { PaddleCommand } from './controller';

export interface PaddleState {
  player: PlayerIndex;
  position: Vec3;
  /** Instantaneous velocity over the last step (used for swept collision). */
  velocity: Vec3;
  /** Low-pass filtered velocity (the swing speed a stroke is judged by). */
  swing: Vec3;
  /** Displayed unit face normal, easing towards `targetNormal`. */
  normal: Vec3;
  targetNormal: Vec3;
  faceHold: number;
  /** Sim time of this paddle's last stroke, and how hard it was (0..1). */
  lastHitTime: number;
  lastHitPower: number;
}

/** Neutral face: pointing at the opponent, slightly open. */
export const restNormal = (player: PlayerIndex): Vec3 =>
  v3(0, Math.sin(PADDLE.restPitch), -sideSign(player) * Math.cos(PADDLE.restPitch));

export function createPaddle(player: PlayerIndex): PaddleState {
  return {
    player,
    position: v3(0, PADDLE.restHeight, sideSign(player) * PADDLE.restZ),
    velocity: v3(), swing: v3(),
    normal: restNormal(player), targetNormal: restNormal(player), faceHold: 0,
    lastHitTime: -Infinity, lastHitPower: 0,
  };
}

export interface PaddleMoveInput {
  command: PaddleCommand;
  /** Travel speed cap of the controlling player, m/s. */
  maxSpeed: number;
  /** Height the paddle should move to (the ball's expected height at the paddle). */
  targetHeight: number;
  /** True while this paddle is holding the ball for a serve. */
  holdingServe: boolean;
  /** True while the tossed ball is in the air: the serving hand stays where it is. */
  frozen: boolean;
}

/** Moves a paddle one timestep towards its command, respecting reach and speed limits. */
export function movePaddle(p: PaddleState, input: PaddleMoveInput, dt: number): void {
  const sign = sideSign(p.player);
  const minDepth = input.holdingServe ? SERVE.minZ : PADDLE.minZ;
  // Serves are played from behind the end line, within the width of the table.
  const reachX = input.holdingServe ? TABLE.width / 2 : PADDLE.maxX;
  const tx = input.frozen ? p.position.x : clamp(input.command.x, -reachX, reachX);
  const tz = input.frozen ? p.position.z : sign * clamp(input.command.z * sign, minDepth, PADDLE.maxZ);
  const overTable = Math.abs(p.position.z) < TABLE_HALF_LENGTH && Math.abs(p.position.x) < TABLE.width / 2;
  const floorY = overTable ? TABLE.surfaceHeight + PADDLE.overTableClearance : PADDLE.minHeight;
  const ty = clamp(input.holdingServe ? SERVE.paddleHeight : input.targetHeight, floorY, PADDLE.maxHeight);

  const k = approach(dt, PADDLE.followTime);
  let dx = (tx - p.position.x) * k;
  let dz = (tz - p.position.z) * k;
  const dy = (ty - p.position.y) * approach(dt, PADDLE.heightFollowTime);
  const travel = Math.hypot(dx, dz);
  const limit = Math.min(input.maxSpeed, PADDLE.maxSpeed) * dt;
  if (travel > limit) {
    dx *= limit / travel;
    dz *= limit / travel;
  }
  p.velocity = v3(dx / dt, dy / dt, dz / dt);
  p.position = v3(p.position.x + dx, p.position.y + dy, p.position.z + dz);
  const s = approach(dt, PADDLE.velocitySmoothing);
  p.swing = v3(mix(p.swing.x, p.velocity.x, s), mix(p.swing.y, p.velocity.y, s), mix(p.swing.z, p.velocity.z, s));

  p.faceHold -= dt;
  if (p.faceHold <= 0) p.targetNormal = restNormal(p.player);
  p.normal = normalize(lerp(p.normal, p.targetNormal, approach(dt, PADDLE.faceFollowTime)), p.targetNormal);
}
