import { Quaternion, Vector3, type TransformNode } from '@babylonjs/core';

const from = new Vector3();
const to = new Vector3();
const delta = new Quaternion();
const parentInverse = new Quaternion();

/** Rotates `node` so the direction from it to `child` points along `direction` (world space). */
export function aimBone(node: TransformNode, child: TransformNode, direction: Vector3): void {
  node.computeWorldMatrix(true);
  child.computeWorldMatrix(true);
  child.getAbsolutePosition().subtractToRef(node.getAbsolutePosition(), from);
  if (from.lengthSquared() < Number.EPSILON || direction.lengthSquared() < Number.EPSILON) return;
  from.normalize();
  to.copyFrom(direction).normalize();
  Quaternion.FromUnitVectorsToRef(from, to, delta);
  const world = delta.multiply(node.absoluteRotationQuaternion);
  const parent = node.parent as TransformNode | null;
  if (parent) {
    parent.computeWorldMatrix(true);
    Quaternion.InverseToRef(parent.absoluteRotationQuaternion, parentInverse);
    node.rotationQuaternion = parentInverse.multiply(world);
  } else {
    node.rotationQuaternion = world;
  }
  node.computeWorldMatrix(true);
}

export interface ArmChain {
  upper: TransformNode;
  lower: TransformNode;
  hand: TransformNode;
}

/**
 * Analytic two-bone IK: bends the arm so the hand reaches `target`, with the elbow pushed towards
 * `pole`. Returns how far short of the target the fully stretched arm falls (0 when reachable).
 */
export function solveArm(chain: ArmChain, target: Vector3, pole: Vector3, slack: number): number {
  const { upper, lower, hand } = chain;
  upper.computeWorldMatrix(true);
  lower.computeWorldMatrix(true);
  hand.computeWorldMatrix(true);
  const shoulder = upper.getAbsolutePosition().clone();
  const l1 = Vector3.Distance(shoulder, lower.getAbsolutePosition());
  const l2 = Vector3.Distance(lower.getAbsolutePosition(), hand.getAbsolutePosition());
  const reach = (l1 + l2) * slack;
  const toTarget = target.subtract(shoulder);
  const wanted = toTarget.length();
  const d = Math.min(Math.max(wanted, Math.abs(l1 - l2) + Number.EPSILON), reach);
  const dir = wanted > Number.EPSILON ? toTarget.scale(1 / wanted) : Vector3.Down();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(l1 * l1 - along * along, 0));
  const side = pole.subtract(dir.scale(Vector3.Dot(pole, dir)));
  if (side.lengthSquared() > Number.EPSILON) side.normalize();
  const elbow = shoulder.add(dir.scale(along)).addInPlace(side.scale(out));
  const wrist = shoulder.add(dir.scale(d));
  aimBone(upper, lower, elbow.subtract(shoulder));
  lower.computeWorldMatrix(true);
  aimBone(lower, hand, wrist.subtract(lower.getAbsolutePosition()));
  return Math.max(0, wanted - reach);
}

/**
 * Layers a procedural rotation over whatever the animation clips wrote this frame. If no clip
 * touched the bone since the last call, the previous clip pose is reused so offsets never stack.
 */
export class AdditivePose {
  private readonly base = new Quaternion();
  private readonly written = new Quaternion();
  private primed = false;

  constructor(private readonly node: TransformNode) {}

  apply(offset: Quaternion): void {
    const q = this.node.rotationQuaternion;
    if (!q) return;
    if (!this.primed || !q.equals(this.written)) this.base.copyFrom(q);
    this.primed = true;
    this.base.multiplyToRef(offset, q);
    this.written.copyFrom(q);
  }
}
