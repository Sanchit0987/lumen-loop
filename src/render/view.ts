import { Color3, Matrix, Scene, type AbstractMesh, type Mesh } from '@babylonjs/core';
import { ATHLETE, QUALITY, type Quality } from '../config/graphics';
import type { PlayerIndex } from '../physics/types';
import { buildArena, type ArenaMeshes } from './arena';
import { Athlete, type Emote } from './athlete';
import { CameraRig, type CameraShot } from './camera';
import { createEngine, type EngineHandle, type RendererKind } from './engine';
import type { Frame } from './frame';
import { Lighting } from './lighting';
import { createMaterials } from './materials';
import { PostFx } from './post';
import { buildBall, buildMarker, buildPaddle, orientPaddle, type PaddleMesh } from './props';
import { buildTable } from './table';

/** Owns the Babylon scene and draws frames handed to it by the game loop. */
export class GameView {
  readonly rig: CameraRig;
  private readonly post: PostFx;
  private readonly receivers: AbstractMesh[];
  private readonly marker: Mesh;
  private quality: Quality;

  static async create(canvas: HTMLCanvasElement, quality: Quality, prefer: RendererKind | null): Promise<GameView> {
    const handle = await createEngine(canvas, prefer);
    const scene = new Scene(handle.engine);
    scene.useRightHandedSystem = true;
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    const materials = await createMaterials(scene, QUALITY[quality]);
    const table = buildTable(scene, materials);
    const arena = buildArena(scene, materials);
    const ball = buildBall(scene, materials);
    const paddles: [PaddleMesh, PaddleMesh] = [buildPaddle(scene, materials, 'paddle0'), buildPaddle(scene, materials, 'paddle1')];
    const athletes: [Athlete, Athlete] = [await Athlete.load(scene, 0), await Athlete.load(scene, 1)];
    const lighting = new Lighting(scene);
    lighting.addCasters([...table.casters, ball, ...paddles.flatMap((p) => p.meshes), ...athletes.flatMap((a) => a.meshes)]);
    const view = new GameView(handle, scene, lighting, arena, ball, paddles, athletes, [...table.receivers, ...arena.receivers], quality);
    await scene.whenReadyAsync();
    return view;
  }

  private constructor(
    readonly handle: EngineHandle,
    readonly scene: Scene,
    private readonly lighting: Lighting,
    private readonly arena: ArenaMeshes,
    private readonly ball: Mesh,
    private readonly paddles: [PaddleMesh, PaddleMesh],
    private readonly athletes: [Athlete, Athlete],
    receivers: AbstractMesh[],
    quality: Quality,
  ) {
    this.receivers = receivers;
    this.quality = quality;
    this.marker = buildMarker(scene);
    this.rig = new CameraRig(scene);
    scene.activeCamera = this.rig.camera;
    this.post = new PostFx(scene, this.rig.camera);
    scene.onAfterAnimationsObservable.add(() => {
      for (const a of this.athletes) a.applyPose();
    });
    this.setQuality(quality);
    this.resize();
  }

  get renderer(): RendererKind {
    return this.handle.kind;
  }

  get fps(): number {
    return this.handle.engine.getFps();
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const q = QUALITY[quality];
    this.lighting.apply(q, this.receivers);
    this.post.apply(q);
    this.arena.crowdRows.forEach((row, i) => row.forEach((m) => m.setEnabled(i < q.crowdRows)));
    this.resize();
  }

  resize(): void {
    const q = QUALITY[this.quality];
    const engine = this.handle.engine;
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    engine.resize();
    this.rig.setAspect(engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
  }

  /**
   * Where the paddle should go for a cursor position: depth from where the cursor ray meets the
   * horizontal plane at `height` (clamped), then x from where the ray crosses that depth, so the
   * paddle stays under the cursor even when its depth is limited.
   */
  projectCursor(clientX: number, clientY: number, height: number, minDepth: number, maxDepth: number): { x: number; depth: number } | null {
    const rect = this.handle.canvas.getBoundingClientRect();
    const engine = this.handle.engine;
    const px = ((clientX - rect.left) / rect.width) * engine.getRenderWidth();
    const py = ((clientY - rect.top) / rect.height) * engine.getRenderHeight();
    const ray = this.scene.createPickingRay(px, py, Matrix.Identity(), this.rig.camera);
    if (ray.direction.z >= 0) return null;
    const ground = ray.direction.y < 0 ? ray.origin.z + (ray.direction.z * (height - ray.origin.y)) / ray.direction.y : -Infinity;
    const depth = Math.min(maxDepth, Math.max(minDepth, ground));
    return { x: ray.origin.x + (ray.direction.x * (depth - ray.origin.z)) / ray.direction.z, depth };
  }

  /** Shows the landing ring at a table position, or hides it. */
  setMarker(at: { x: number; z: number } | null): void {
    this.marker.setEnabled(at !== null);
    if (at) {
      this.marker.position.x = at.x;
      this.marker.position.z = at.z;
    }
  }

  setTint(player: PlayerIndex, rgb: readonly [number, number, number]): void {
    this.athletes[player].setColour(new Color3(rgb[0], rgb[1], rgb[2]).toLinearSpace());
  }

  emote(player: PlayerIndex, emote: Emote): void {
    this.athletes[player].play(emote);
  }

  clearEmotes(): void {
    for (const a of this.athletes) a.stopEmote();
  }

  /** Draws one frame. `dt` is real seconds; `timeScale` slows body animation (0 when paused). */
  render(frame: Frame, shot: CameraShot, dt: number, timeScale: number): void {
    this.ball.position.set(frame.ball.x, frame.ball.y, frame.ball.z);
    this.ball.rotationQuaternion!.set(...frame.ballRotation);
    for (const i of [0, 1] as const) {
      const p = frame.paddles[i];
      const handle = orientPaddle(this.paddles[i], p.position, p.normal, i === 0 ? 1 : -1);
      this.athletes[i].update(p, handle, dt * timeScale, timeScale);
    }
    this.athletes[0].fadeTo(shot.kind === 'play' ? ATHLETE.nearOpacity : 1, dt);
    this.rig.update(shot, frame, dt);
    const subject = shot.kind === 'play' ? frame.paddles[1].position : frame.ball;
    const distance = this.rig.distanceTo(subject.x, subject.y, subject.z);
    if (this.rig.cut) this.post.snapFocus(distance);
    this.post.setFocus(distance, shot.kind === 'replay', dt);
    this.scene.render();
  }
}
