import { Color3, PBRMaterial, type BaseTexture, type Scene } from '@babylonjs/core';
import { COLOURS, LIGHTS, SURFACE_LOOK, type QualityPreset } from '../config/graphics';
import { linear } from './colour';
import { createBallTexture, createNetTexture, createTableTopTexture, loadTexture } from './textures';

export interface Materials {
  tableTop: PBRMaterial;
  tableEdge: PBRMaterial;
  steel: PBRMaterial;
  netMesh: PBRMaterial;
  netTape: PBRMaterial;
  ball: PBRMaterial;
  rubberFore: PBRMaterial;
  rubberBack: PBRMaterial;
  wood: PBRMaterial;
  floor: PBRMaterial;
  floorOuter: PBRMaterial;
  wall: PBRMaterial;
  stand: PBRMaterial;
  panel: PBRMaterial;
}

const NET_TEXTURE_SIZE = 256;
const NET_CELLS = 12;
const BALL_TEXTURE_SIZE = 256;

function pbr(scene: Scene, name: string, colour: string, roughness: number, metallic = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = linear(colour);
  m.roughness = roughness;
  m.metallic = metallic;
  return m;
}

/** Poly Haven normal maps are OpenGL convention; the scene is right-handed. */
function setNormal(m: PBRMaterial, texture: BaseTexture, strength: number): void {
  m.bumpTexture = texture;
  m.bumpTexture.level = strength;
  m.invertNormalMapX = false;
  m.invertNormalMapY = true;
}

/** Uses a packed AO/roughness/metallic texture. */
function setArm(m: PBRMaterial, texture: BaseTexture): void {
  m.metallicTexture = texture;
  m.useAmbientOcclusionFromMetallicTextureRed = true;
  m.useRoughnessFromMetallicTextureGreen = true;
  m.useMetallnessFromMetallicTextureBlue = true;
  m.metallic = 1;
  m.roughness = 1;
}

export async function createMaterials(scene: Scene, quality: QualityPreset): Promise<Materials> {
  const aniso = quality.anisotropy;
  const look = SURFACE_LOOK;

  // Painted, varnished table: wood grain under the paint, clear coat on top.
  const tableTop = pbr(scene, 'tableTop', '#ffffff', look.tableRoughness);
  tableTop.albedoTexture = await createTableTopTexture(scene, aniso);
  const grainNormal = loadTexture(scene, 'fine_grained_wood_nor_gl_1k.jpg', 1, aniso);
  grainNormal.vScale = 2;
  setNormal(tableTop, grainNormal, look.grainBump);
  tableTop.clearCoat.isEnabled = true;
  tableTop.clearCoat.intensity = look.varnishIntensity;
  tableTop.clearCoat.roughness = look.varnishRoughness;

  const wood = pbr(scene, 'wood', '#ffffff', 1);
  wood.albedoTexture = loadTexture(scene, 'plywood_diff_1k.jpg', look.woodTiling, aniso);
  setNormal(wood, loadTexture(scene, 'plywood_nor_gl_1k.jpg', look.woodTiling, aniso), 1);
  setArm(wood, loadTexture(scene, 'plywood_arm_1k.jpg', look.woodTiling, aniso));

  // Paddle rubber: pimpled sheet from a rubber surface normal map, tinted per side.
  const rubberNormal = loadTexture(scene, 'rubberized_track_nor_gl_1k.jpg', look.rubberTiling, aniso);
  const rubber = (name: string, colour: string): PBRMaterial => {
    const m = pbr(scene, name, colour, look.rubberRoughness);
    setNormal(m, rubberNormal, look.rubberBump);
    return m;
  };

  const floor = pbr(scene, 'floor', COLOURS.floor, look.floorRoughness);
  floor.albedoTexture = loadTexture(scene, 'rubberized_track_diff_1k.jpg', look.floorTiling, aniso);
  setNormal(floor, loadTexture(scene, 'rubberized_track_nor_gl_1k.jpg', look.floorTiling, aniso), look.floorBump);
  setArm(floor, loadTexture(scene, 'rubberized_track_arm_1k.jpg', look.floorTiling, aniso));

  const netMesh = pbr(scene, 'netMesh', COLOURS.netMesh, 1);
  const netTexture = createNetTexture(scene, NET_TEXTURE_SIZE, NET_CELLS);
  netTexture.uScale = NET_CELLS;
  netMesh.albedoTexture = netTexture;
  netMesh.albedoColor = Color3.White();
  netMesh.useAlphaFromAlbedoTexture = true;
  netMesh.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  netMesh.backFaceCulling = false;

  const ball = pbr(scene, 'ball', '#ffffff', look.ballRoughness);
  ball.albedoTexture = createBallTexture(scene, BALL_TEXTURE_SIZE);

  const panel = pbr(scene, 'panel', COLOURS.panel, 1);
  panel.emissiveColor = linear(COLOURS.panel).scale(LIGHTS.panelEmissive);
  panel.disableLighting = true;

  return {
    tableTop, wood, floor, netMesh, ball, panel,
    tableEdge: pbr(scene, 'tableEdge', COLOURS.tableEdge, look.tableRoughness),
    steel: pbr(scene, 'steel', COLOURS.tableSteel, look.robotRoughness, 1),
    netTape: pbr(scene, 'netTape', COLOURS.netTape, 1),
    rubberFore: rubber('rubberFore', COLOURS.rubberFore),
    rubberBack: rubber('rubberBack', COLOURS.rubberBack),
    floorOuter: pbr(scene, 'floorOuter', COLOURS.floorOuter, look.floorRoughness),
    wall: pbr(scene, 'wall', COLOURS.wall, 1),
    stand: pbr(scene, 'stand', COLOURS.stand, 1),
  };
}
