import { MeshBuilder, PBRMaterial, TransformNode, type Mesh, type Scene, type Texture } from '@babylonjs/core';
import { COLOURS, CROWD, LIGHTS, SURFACE_LOOK } from '../config/graphics';
import { ARENA } from '../config/table';
import { linear } from './colour';
import type { Materials } from './materials';
import { createBannerTexture, createCrowdTexture } from './textures';

export interface ArenaMeshes {
  root: TransformNode;
  receivers: Mesh[];
  /** Crowd strips grouped by row index, so quality presets can hide the upper rows. */
  crowdRows: Mesh[][];
}

const BANNER_WIDTH = 1024;
const BANNER_HEIGHT = 128;
const BANNER_TEXT = ['LUMEN LOOP', 'SPIN \u00b7 LOOP \u00b7 SMASH', 'LUMEN LOOP OPEN'];
const QUARTER_TURN = Math.PI / 2;
const FLOOR_LIFT = 0.002;

/** Indoor hall: court floor, surrounds with banners, stepped stands with a blurred crowd, light rig. */
export function buildArena(scene: Scene, m: Materials): ArenaMeshes {
  const root = new TransformNode('arena', scene);
  const A = ARENA;
  const add = <T extends Mesh>(mesh: T): T => {
    mesh.parent = root;
    return mesh;
  };

  const outer = add(MeshBuilder.CreateGround('floorOuter', { width: A.floorHalfSize * 2, height: A.floorHalfSize * 2 }, scene));
  outer.material = m.floorOuter;
  const court = add(MeshBuilder.CreateGround('court', { width: A.courtHalfWidth * 2, height: A.courtHalfLength * 2 }, scene));
  court.position.y = FLOOR_LIFT;
  court.material = m.floor;

  // Court surrounds: four low barriers carrying banners.
  const banner = (text: string): PBRMaterial => {
    const mat = new PBRMaterial(`banner-${text}`, scene);
    mat.albedoTexture = createBannerTexture(scene, text, BANNER_WIDTH, BANNER_HEIGHT);
    mat.roughness = SURFACE_LOOK.floorRoughness;
    mat.metallic = 0;
    return mat;
  };
  const sides: { x: number; z: number; length: number; turn: number }[] = [
    { x: 0, z: -A.courtHalfLength, length: A.courtHalfWidth * 2, turn: 0 },
    { x: 0, z: A.courtHalfLength, length: A.courtHalfWidth * 2, turn: 2 },
    { x: -A.courtHalfWidth, z: 0, length: A.courtHalfLength * 2, turn: 1 },
    { x: A.courtHalfWidth, z: 0, length: A.courtHalfLength * 2, turn: 3 },
  ];
  sides.forEach((s, i) => {
    const wall = add(MeshBuilder.CreateBox('barrier', { width: s.length, height: A.barrierHeight, depth: A.barrierThickness }, scene));
    wall.position.set(s.x, A.barrierHeight / 2, s.z);
    wall.rotation.y = s.turn * QUARTER_TURN;
    const mat = banner(BANNER_TEXT[i % BANNER_TEXT.length]);
    (mat.albedoTexture as Texture).uScale = Math.round(s.length / (A.barrierHeight * (BANNER_WIDTH / BANNER_HEIGHT)) + 1);
    wall.material = mat;
  });

  // Stands with crowd strips on all four sides.
  const crowdRows: Mesh[][] = Array.from({ length: A.standRows }, () => []);
  const crowdMaterial = (seed: number): PBRMaterial => {
    const mat = new PBRMaterial(`crowd${seed}`, scene);
    mat.albedoColor = linear('#000000');
    mat.emissiveTexture = createCrowdTexture(scene, seed);
    mat.emissiveColor = linear('#ffffff').scale(CROWD.brightness);
    mat.roughness = 1;
    mat.metallic = 0;
    mat.disableLighting = true;
    return mat;
  };
  sides.forEach((s, sideIndex) => {
    const side = new TransformNode(`stand${sideIndex}`, scene);
    side.parent = root;
    side.position.set(s.x, 0, s.z);
    side.rotation.y = s.turn * QUARTER_TURN;
    const length = s.length + A.standGap * 2 + A.standRows * A.standRowDepth * 2;
    for (let row = 0; row < A.standRows; row++) {
      const depth = A.standGap + row * A.standRowDepth;
      const height = A.barrierHeight + row * A.standRowRise;
      const step = MeshBuilder.CreateBox('step', { width: length, height, depth: A.standRowDepth }, scene);
      step.parent = side;
      step.position.set(0, height / 2, -(depth + A.standRowDepth / 2));
      step.material = m.stand;
      const strip = MeshBuilder.CreatePlane('crowd', { width: length, height: CROWD.rowHeight }, scene);
      strip.parent = side;
      strip.position.set(0, height + CROWD.rowHeight / 2, -(depth + A.standRowDepth / 2));
      strip.rotation.y = Math.PI;
      const mat = crowdMaterial(sideIndex * A.standRows + row);
      (mat.emissiveTexture as Texture).uScale = Math.max(1, Math.round(length / (CROWD.rowHeight * (CROWD.textureWidth / CROWD.textureHeight))));
      strip.material = mat;
      crowdRows[row].push(strip);
    }
    const back = MeshBuilder.CreatePlane('wall', { width: A.floorHalfSize * 4, height: A.wallHeight }, scene);
    back.parent = side;
    back.position.set(0, A.wallHeight / 2, -(A.standGap + (A.standRows + 1) * A.standRowDepth));
    back.rotation.y = Math.PI;
    back.material = m.wall;
  });

  // Overhead light panels: emissive, so they bloom and show up in the varnish.
  for (let i = 0; i < LIGHTS.panelCount; i++) {
    for (const sx of [-1, 1]) {
      const panel = add(MeshBuilder.CreatePlane('panel', { width: LIGHTS.panelWidth, height: LIGHTS.panelLength }, scene));
      panel.position.set(sx * LIGHTS.panelWidth * 2, A.lightRigHeight, (i - (LIGHTS.panelCount - 1) / 2) * LIGHTS.panelSpacing);
      panel.rotation.x = -QUARTER_TURN;
      panel.material = m.panel;
    }
  }
  const truss = add(MeshBuilder.CreateBox('truss', { width: LIGHTS.panelWidth * 6, height: LIGHTS.trussThickness, depth: LIGHTS.panelCount * LIGHTS.panelSpacing }, scene));
  truss.position.y = A.lightRigHeight + LIGHTS.trussThickness * 2;
  truss.material = m.wall;

  scene.clearColor = linear(COLOURS.clear).toColor4(1);
  return { root, receivers: [outer, court], crowdRows };
}
