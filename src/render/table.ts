import { MeshBuilder, TransformNode, type Mesh, type Scene } from '@babylonjs/core';
import { NET, NET_HALF_WIDTH, TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../config/table';
import type { Materials } from './materials';

export interface TableMeshes {
  root: TransformNode;
  casters: Mesh[];
  receivers: Mesh[];
}

const POST_SEGMENTS = 12;
/** Lift decals/overlays by this much to avoid z-fighting. */
const OVERLAY_LIFT = 0.0006;

/** Regulation table with painted top, steel undercarriage, net, tape and posts. */
export function buildTable(scene: Scene, m: Materials): TableMeshes {
  const root = new TransformNode('table', scene);
  const add = <T extends Mesh>(mesh: T): T => {
    mesh.parent = root;
    return mesh;
  };
  const slab = add(MeshBuilder.CreateBox('tableSlab', { width: TABLE.width, height: TABLE.thickness, depth: TABLE.length }, scene));
  slab.position.y = TABLE.surfaceHeight - TABLE.thickness / 2 - OVERLAY_LIFT;
  slab.material = m.tableEdge;

  const top = add(MeshBuilder.CreateGround('tableTop', { width: TABLE.width, height: TABLE.length }, scene));
  top.position.y = TABLE.surfaceHeight;
  top.material = m.tableTop;

  const casters: Mesh[] = [slab];
  const apronY = TABLE.surfaceHeight - TABLE.thickness - TABLE.apronDrop / 2;
  for (const sx of [-1, 1]) {
    const rail = add(MeshBuilder.CreateBox('rail', { width: TABLE.legSize / 2, height: TABLE.apronDrop, depth: TABLE.length - TABLE.legInset }, scene));
    rail.position.set(sx * (TABLE_HALF_WIDTH - TABLE.legInset / 2), apronY, 0);
    rail.material = m.steel;
    for (const sz of [-1, 1]) {
      const legHeight = TABLE.surfaceHeight - TABLE.thickness;
      const leg = add(MeshBuilder.CreateBox('leg', { width: TABLE.legSize, height: legHeight, depth: TABLE.legSize }, scene));
      leg.position.set(sx * (TABLE_HALF_WIDTH - TABLE.legInset / 2), legHeight / 2, sz * (TABLE_HALF_LENGTH - TABLE.legInset));
      leg.material = m.steel;
      casters.push(leg);
    }
  }
  for (const sz of [-1, 1]) {
    const cross = add(MeshBuilder.CreateBox('cross', { width: TABLE.width - TABLE.legInset, height: TABLE.apronDrop, depth: TABLE.legSize / 2 }, scene));
    cross.position.set(0, apronY, sz * (TABLE_HALF_LENGTH - TABLE.legInset));
    cross.material = m.steel;
  }

  const meshHeight = NET.height - NET.tapeHeight;
  const net = add(MeshBuilder.CreatePlane('net', { width: NET_HALF_WIDTH * 2, height: meshHeight }, scene));
  net.position.y = TABLE.surfaceHeight + meshHeight / 2;
  net.material = m.netMesh;
  const tape = add(MeshBuilder.CreateBox('netTape', { width: NET_HALF_WIDTH * 2, height: NET.tapeHeight, depth: NET.thickness / 2 }, scene));
  tape.position.y = TABLE.surfaceHeight + NET.height - NET.tapeHeight / 2;
  tape.material = m.netTape;
  casters.push(tape);
  for (const sx of [-1, 1]) {
    const post = add(MeshBuilder.CreateCylinder('netPost', { diameter: NET.postRadius * 2, height: NET.height + TABLE.thickness, tessellation: POST_SEGMENTS }, scene));
    post.position.set(sx * NET_HALF_WIDTH, TABLE.surfaceHeight + (NET.height - TABLE.thickness) / 2, 0);
    post.material = m.steel;
    casters.push(post);
  }
  return { root, casters, receivers: [top, slab] };
}
