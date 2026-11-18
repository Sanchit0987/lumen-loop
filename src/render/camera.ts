import { FreeCamera, Vector3, type Scene } from '@babylonjs/core';
import { CAMERA } from '../config/graphics';
import { REPLAY_LOOK_HEIGHT, type ReplayCamera } from '../config/match';
import { approach } from '../math/vec3';
import type { Frame } from './frame';

export type CameraShot =
  | { kind: 'play' }
  | { kind: 'orbit' }
  | { kind: 'replay'; index: number; camera: ReplayCamera };

const shotKey = (s: CameraShot): string => (s.kind === 'replay' ? `replay${s.index}` : s.kind);

/** Behind-the-player follow camera, menu orbit, and fixed replay angles with hard cuts. */
export class CameraRig {
  readonly camera: FreeCamera;
  private readonly position = new Vector3(0, CAMERA.height, CAMERA.distance);
  private readonly target = new Vector3(0, CAMERA.lookHeight, CAMERA.lookDepth);
  private readonly wantPosition = new Vector3();
  private readonly wantTarget = new Vector3();
  private current = '';
  private orbitAngle = 0;
  /** True for the frame on which the shot changed. */
  cut = false;

  constructor(scene: Scene) {
    this.camera = new FreeCamera('camera', this.position.clone(), scene);
    this.camera.minZ = CAMERA.near;
    this.camera.maxZ = CAMERA.far;
    this.camera.fov = CAMERA.fov;
    this.camera.inputs.clear();
  }

  /** Widens the field of view on narrow (portrait) screens so the table stays in frame. */
  setAspect(aspect: number): void {
    const half = Math.tan(CAMERA.fov / 2) * Math.max(1, CAMERA.wideAspect / aspect);
    this.camera.fov = Math.min(CAMERA.maxFov, 2 * Math.atan(half));
  }

  update(shot: CameraShot, frame: Frame, dt: number): void {
    const ball = frame.ball;
    if (shot.kind === 'play') {
      const paddle = frame.paddles[0].position;
      this.wantPosition.set(paddle.x * CAMERA.followPaddleX, CAMERA.height, CAMERA.distance);
      this.wantTarget.set(
        ball.x * CAMERA.followBallX,
        CAMERA.lookHeight + (ball.y - CAMERA.lookHeight) * CAMERA.followBallY,
        CAMERA.lookDepth + ball.z * CAMERA.followBallZ,
      );
    } else if (shot.kind === 'orbit') {
      this.orbitAngle += CAMERA.orbitSpeed * dt;
      this.wantPosition.set(Math.sin(this.orbitAngle) * CAMERA.orbitRadius, CAMERA.orbitHeight, Math.cos(this.orbitAngle) * CAMERA.orbitRadius);
      this.wantTarget.set(ball.x * CAMERA.followBallX, CAMERA.orbitLookHeight, ball.z * CAMERA.followBallX);
    } else {
      const [x, y, z] = shot.camera.position;
      const f = shot.camera.follow;
      this.wantPosition.set(x, y, z);
      this.wantTarget.set(ball.x * f, REPLAY_LOOK_HEIGHT + (ball.y - REPLAY_LOOK_HEIGHT) * f, ball.z * f);
    }

    const key = shotKey(shot);
    this.cut = key !== this.current;
    this.current = key;
    const kp = this.cut ? 1 : approach(dt, CAMERA.positionSmoothing);
    const kt = this.cut ? 1 : approach(dt, CAMERA.aimSmoothing);
    Vector3.LerpToRef(this.position, this.wantPosition, kp, this.position);
    Vector3.LerpToRef(this.target, this.wantTarget, kt, this.target);
    this.camera.position.copyFrom(this.position);
    this.camera.setTarget(this.target);
  }

  distanceTo(x: number, y: number, z: number): number {
    return Math.hypot(this.position.x - x, this.position.y - y, this.position.z - z);
  }
}
