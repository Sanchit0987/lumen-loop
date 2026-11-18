import { Matrix, MeshBuilder, PBRMaterial, Quaternion, TransformNode, Vector3, type Mesh, type Scene } from '@babylonjs/core';
import { BALL } from '../config/ball';
import { ATHLETE, MARKER } from '../config/graphics';
import { TABLE } from '../config/table';
import { linear } from './colour';
import { PADDLE } from '../config/paddle';
import type { Vec3 } from '../math/vec3';
import type { Materials } from './materials';

const BALL_SEGMENTS = 24;
const BLADE_SEGMENTS = 40;
const QUARTER_TURN = Math.PI / 2;

export function buildBall(scene: Scene, m: Materials): Mesh {
  const ball = MeshBuilder.CreateSphere('ball', { diameter: BALL.radius * 2, segments: BALL_SEGMENTS }, scene);
  ball.material = m.ball;
  ball.rotationQuaternion = Quaternion.Identity();
  return ball;
}

/** Flat glowing ring laid on the table to show where the incoming ball will land. */
export function buildMarker(scene: Scene): Mesh {
  const ring = MeshBuilder.CreateTorus('marker', { diameter: MARKER.radius * 2, thickness: MARKER.thickness, tessellation: MARKER.tessellation }, scene);
  ring.scaling.y = MARKER.lift;
  ring.position.y = TABLE.surfaceHeight + MARKER.lift;
  const mat = new PBRMaterial('marker', scene);
  mat.albedoColor = linear(MARKER.colour);
  mat.emissiveColor = linear(MARKER.colour).scale(MARKER.emissive);
  mat.disableLighting = true;
  mat.alpha = MARKER.alpha;
  ring.material = mat;
  ring.setEnabled(false);
  return ring;
}

export interface PaddleMesh {
  root: TransformNode;
  meshes: Mesh[];
}

/** Paddle modelled with its face normal along local +Z and the handle along local -Y. */
export function buildPaddle(scene: Scene, m: Materials, name: string): PaddleMesh {
  const root = new TransformNode(name, scene);
  root.rotationQuaternion = Quaternion.Identity();
  const disc = (id: string, thickness: number, z: number, material: Materials[keyof Materials]): Mesh => {
    const mesh = MeshBuilder.CreateCylinder(id, { diameter: PADDLE.bladeRadius * 2, height: thickness, tessellation: BLADE_SEGMENTS }, scene);
    mesh.rotation.x = QUARTER_TURN;
    mesh.position.z = z;
    mesh.material = material;
    mesh.parent = root;
    return mesh;
  };
  const rubberZ = (PADDLE.bladeThickness + PADDLE.rubberThickness) / 2;
  const blade = disc('blade', PADDLE.bladeThickness, 0, m.wood);
  const fore = disc('rubberFore', PADDLE.rubberThickness, rubberZ, m.rubberFore);
  const back = disc('rubberBack', PADDLE.rubberThickness, -rubberZ, m.rubberBack);
  const handle = MeshBuilder.CreateBox('handle', { width: PADDLE.handleWidth, height: PADDLE.handleLength, depth: PADDLE.handleDepth }, scene);
  handle.position.y = -(PADDLE.bladeRadius + PADDLE.handleLength / 2 - PADDLE.handleDepth / 2);
  handle.material = m.wood;
  handle.parent = root;
  return { root, meshes: [blade, fore, back, handle] };
}

const tmpMatrix = new Matrix();

/** Unit vector along which the handle points for a given face normal and playing side. */
export function handleDirection(normal: Vec3, sideSign: number): Vector3 {
  const n = new Vector3(normal.x, normal.y, normal.z);
  // Down and outwards (forehand grip), projected into the plane of the blade.
  const [gx, gy, gz] = ATHLETE.gripDirection;
  const wanted = new Vector3(sideSign * gx, gy, sideSign * gz);
  const h = wanted.subtract(n.scale(Vector3.Dot(wanted, n)));
  return h.lengthSquared() > Number.EPSILON ? h.normalize() : new Vector3(0, -1, 0);
}

/** Places a paddle so its face points along `normal` with the handle towards the player's hand. */
export function orientPaddle(paddle: PaddleMesh, position: Vec3, normal: Vec3, sideSign: number): Vector3 {
  const z = new Vector3(normal.x, normal.y, normal.z).normalize();
  const handle = handleDirection(normal, sideSign);
  const y = handle.scale(-1);
  const x = Vector3.Cross(y, z).normalize();
  Matrix.FromXYZAxesToRef(x, y, z, tmpMatrix);
  Quaternion.FromRotationMatrixToRef(tmpMatrix, paddle.root.rotationQuaternion!);
  paddle.root.position.set(position.x, position.y, position.z);
  return handle;
}
