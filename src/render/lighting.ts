import {
  DirectionalLight, HDRCubeTexture, HemisphericLight, ShadowGenerator, Vector3, type AbstractMesh, type Scene,
} from '@babylonjs/core';
import { LIGHTS, type QualityPreset } from '../config/graphics';
import { ARENA } from '../config/table';
import { assetUrl } from './textures';

const HDRI_FILE = 'hdri/gym_01_1k.hdr';
const HDRI_CUBE_SIZE = 256;

/** HDRI image-based lighting plus one shadow-casting key light over the table. */
export class Lighting {
  private readonly key: DirectionalLight;
  private shadows: ShadowGenerator | null = null;
  private readonly casters: AbstractMesh[] = [];

  constructor(scene: Scene) {
    const env = new HDRCubeTexture(assetUrl(HDRI_FILE), scene, HDRI_CUBE_SIZE, false, true, false, true);
    scene.environmentTexture = env;
    scene.environmentIntensity = LIGHTS.environmentIntensity;

    const [dx, dy, dz] = LIGHTS.keyDirection;
    const direction = new Vector3(dx, dy, dz).normalize();
    this.key = new DirectionalLight('key', direction, scene);
    this.key.position = direction.scale(-LIGHTS.keyHeight);
    this.key.intensity = LIGHTS.keyIntensity;
    this.key.autoUpdateExtends = false;
    this.key.orthoLeft = -LIGHTS.shadowExtent;
    this.key.orthoRight = LIGHTS.shadowExtent;
    this.key.orthoBottom = -LIGHTS.shadowExtent;
    this.key.orthoTop = LIGHTS.shadowExtent;
    this.key.shadowMinZ = 1;
    this.key.shadowMaxZ = LIGHTS.keyHeight + ARENA.lightRigHeight;

    const fill = new HemisphericLight('fill', Vector3.Up(), scene);
    fill.intensity = LIGHTS.fillIntensity;
  }

  addCasters(meshes: readonly AbstractMesh[]): void {
    this.casters.push(...meshes);
    for (const m of meshes) this.shadows?.addShadowCaster(m, false);
  }

  /** (Re)builds the shadow map for a quality preset: PCF on low/medium, PCSS on high. */
  apply(quality: QualityPreset, receivers: readonly AbstractMesh[]): void {
    this.shadows?.dispose();
    const gen = new ShadowGenerator(quality.shadowMapSize, this.key);
    gen.bias = LIGHTS.shadowBias;
    gen.normalBias = LIGHTS.shadowNormalBias;
    gen.darkness = LIGHTS.shadowDarkness;
    if (quality.contactHardening) {
      gen.useContactHardeningShadow = true;
      gen.contactHardeningLightSizeUVRatio = LIGHTS.shadowSoftness;
      gen.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    } else {
      gen.usePercentageCloserFiltering = true;
      gen.filteringQuality = quality.shadowMapSize > LIGHTS.sharpShadowMapSize ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    }
    for (const m of this.casters) gen.addShadowCaster(m, false);
    for (const r of receivers) r.receiveShadows = true;
    this.shadows = gen;
  }
}
