import {
  AbstractMesh, LoadAssetContainerAsync, PBRMaterial, Quaternion, TransformNode, Vector3,
  type AnimationGroup, type Color3, type Scene,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF/2.0';
import { ATHLETE } from '../config/graphics';
import { TABLE_HALF_LENGTH } from '../config/table';
import { approach, clamp, clamp01 } from '../math/vec3';
import type { PlayerIndex } from '../physics/types';
import type { PaddleFrame } from './frame';
import { AdditivePose, solveArm, type ArmChain } from './ik';
import { assetUrl } from './textures';

export type Emote = keyof typeof ATHLETE.clips;

const UP = Vector3.Up();
const RIGHT = Vector3.Right();

/**
 * Rigged robot athlete. Legs and body play blended idle/run clips from the glTF; the playing arm is
 * driven by two-bone IK to the paddle grip and the torso twists and leans with the swing, so every
 * stroke animation comes from the actual paddle motion.
 */
export class Athlete {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  private readonly sign: number;
  private readonly clips = new Map<string, AnimationGroup>();
  private readonly arm: ArmChain;
  private readonly torsoPose: AdditivePose;
  private readonly hipsPose: AdditivePose;
  private readonly tint: PBRMaterial | null;
  private readonly grip = new Vector3();
  private readonly lastPosition = new Vector3();
  private twist = 0;
  private lean = 0;
  private run = 0;
  private opacity = 1;
  private emote: AnimationGroup | null = null;

  static async load(scene: Scene, player: PlayerIndex): Promise<Athlete> {
    const container = await LoadAssetContainerAsync(assetUrl(ATHLETE.model), scene);
    container.addAllToScene();
    return new Athlete(scene, player, container.rootNodes[0] as TransformNode, container.animationGroups, container.meshes);
  }

  private constructor(scene: Scene, player: PlayerIndex, model: TransformNode, groups: AnimationGroup[], meshes: AbstractMesh[]) {
    this.sign = player === 0 ? 1 : -1;
    this.meshes = meshes.filter((m) => m.getTotalVertices() > 0);
    this.root = new TransformNode(`athlete${player}`, scene);
    model.parent = this.root;
    for (const g of groups) {
      g.stop();
      this.clips.set(g.name, g);
    }
    const bounds = model.getHierarchyBoundingVectors();
    const scale = ATHLETE.height / (bounds.max.y - bounds.min.y);
    this.root.scaling.setAll(scale);
    // The model faces +Z; player 0 stands at +Z and must face the net at -Z.
    this.root.rotation.y = player === 0 ? Math.PI : 0;

    const bone = (name: string): TransformNode => {
      const node = model.getChildTransformNodes(false, (n) => n.name === name && !(n instanceof AbstractMesh))[0];
      if (!node) throw new Error(`Athlete rig is missing bone ${name}`);
      return node;
    };
    const b = ATHLETE.bones;
    this.arm = { upper: bone(b.upperArm), lower: bone(b.lowerArm), hand: bone(b.hand) };
    this.torsoPose = new AdditivePose(bone(b.torso));
    this.hipsPose = new AdditivePose(bone(b.hips));
    const tint = this.meshes.map((m) => m.material).find((m) => m?.name === ATHLETE.tintMaterial);
    this.tint = tint instanceof PBRMaterial ? tint : null;

    for (const name of [ATHLETE.clips.idle, ATHLETE.clips.run]) {
      const g = this.clips.get(name);
      g?.start(true);
      if (g) g.weight = name === ATHLETE.clips.idle ? 1 : 0;
    }
    this.root.position.set(0, 0, this.sign * (TABLE_HALF_LENGTH + ATHLETE.backOffset * 2));
    this.lastPosition.copyFrom(this.root.position);
  }

  setColour(colour: Color3): void {
    if (this.tint) this.tint.albedoColor = colour;
  }

  /** Fades the whole body towards an opacity (the near player is ghosted in the play camera). */
  fadeTo(opacity: number, dt: number): void {
    this.opacity += (opacity - this.opacity) * approach(dt, ATHLETE.opacityFadeTime);
    const ghost = this.opacity < ATHLETE.opaqueAbove;
    for (const m of this.meshes) {
      m.visibility = ghost ? this.opacity : 1;
      const mat = m.material;
      if (!(mat instanceof PBRMaterial)) continue;
      mat.transparencyMode = ghost ? PBRMaterial.PBRMATERIAL_ALPHABLEND : PBRMaterial.PBRMATERIAL_OPAQUE;
      // Depth pre-pass keeps the ghost from showing its own inside faces.
      mat.needDepthPrePass = ghost;
    }
  }

  /** Plays a one-shot body clip (celebration, head shake) over the idle/run blend. */
  play(emote: Emote): void {
    const group = this.clips.get(ATHLETE.clips[emote]);
    if (!group) return;
    this.emote?.stop();
    this.emote = group;
    group.start(false);
    group.weight = 1;
    group.onAnimationGroupEndObservable.addOnce(() => {
      if (this.emote === group) this.emote = null;
    });
  }

  stopEmote(): void {
    this.emote?.stop();
    this.emote = null;
  }

  /** Moves the body after the paddle and updates clip speeds/weights. `dt` is scaled scene time. */
  update(paddle: PaddleFrame, handle: Vector3, dt: number, timeScale: number): void {
    const p = paddle.position;
    this.grip.set(p.x + handle.x * ATHLETE.gripOffset, p.y + handle.y * ATHLETE.gripOffset, p.z + handle.z * ATHLETE.gripOffset);
    const minDepth = TABLE_HALF_LENGTH + ATHLETE.minDepthClearance;
    const targetX = p.x - this.sign * ATHLETE.sideOffset;
    const targetZ = this.sign * Math.max(minDepth, p.z * this.sign + ATHLETE.backOffset);
    const k = approach(dt, ATHLETE.followTime);
    const pos = this.root.position;
    pos.x += (targetX - pos.x) * k;
    pos.z += (targetZ - pos.z) * k;

    const speed = dt > 0 ? Math.hypot(pos.x - this.lastPosition.x, pos.z - this.lastPosition.z) / dt : 0;
    this.lastPosition.copyFrom(pos);
    const blend = approach(dt, ATHLETE.blendTime);
    this.run += (clamp01(speed / ATHLETE.runSpeed) - this.run) * blend;
    const reachOver = clamp01((pos.z * this.sign - p.z * this.sign - ATHLETE.backOffset) / ATHLETE.leanDistance);
    this.lean += (reachOver * ATHLETE.maxLean - this.lean) * blend;
    const wantedTwist = clamp(-paddle.swing.x * this.sign * ATHLETE.twistPerSpeed, -ATHLETE.maxTwist, ATHLETE.maxTwist);
    this.twist += (wantedTwist - this.twist) * approach(dt, ATHLETE.twistSmoothing);

    const idle = this.clips.get(ATHLETE.clips.idle);
    const run = this.clips.get(ATHLETE.clips.run);
    const body = this.emote ? 0 : 1;
    if (idle) { idle.weight = (1 - this.run) * body; idle.speedRatio = timeScale; }
    if (run) { run.weight = this.run * body; run.speedRatio = timeScale; }
    if (this.emote) this.emote.speedRatio = timeScale;
  }

  /** Applies procedural pose on top of the clips; call after the scene has evaluated animations. */
  applyPose(): void {
    this.torsoPose.apply(Quaternion.RotationAxis(UP, this.twist));
    this.hipsPose.apply(Quaternion.RotationAxis(RIGHT, this.lean));
    const [px, py, pz] = ATHLETE.elbowPole;
    const pole = new Vector3(px * this.sign, py, pz * this.sign);
    const shortfall = solveArm(this.arm, this.grip, pole, ATHLETE.reachSlack);
    if (shortfall > 0) {
      // The arm cannot reach: step the body towards the paddle so the hand never leaves the grip.
      const pos = this.root.position;
      const shoulder = this.arm.upper.getAbsolutePosition();
      const dx = this.grip.x - shoulder.x;
      const dz = this.grip.z - shoulder.z;
      const flat = Math.hypot(dx, dz);
      if (flat > Number.EPSILON) {
        pos.x += (dx / flat) * shortfall;
        pos.z += (dz / flat) * shortfall;
        this.root.computeWorldMatrix(true);
        solveArm(this.arm, this.grip, pole, ATHLETE.reachSlack);
      }
    }
  }
}
