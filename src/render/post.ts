import {
  DefaultRenderingPipeline, DepthOfFieldEffectBlurLevel, ImageProcessingConfiguration, SSAO2RenderingPipeline,
  type Camera, type Scene,
} from '@babylonjs/core';
import { POST, type QualityPreset } from '../config/graphics';
import { approach } from '../math/vec3';

const BLUR_LEVELS = [DepthOfFieldEffectBlurLevel.Low, DepthOfFieldEffectBlurLevel.Medium, DepthOfFieldEffectBlurLevel.High];

/** Post-processing stack: SSAO, bloom, depth of field, FXAA/MSAA, ACES tone mapping and vignette. */
export class PostFx {
  private pipeline: DefaultRenderingPipeline | null = null;
  private ssao: SSAO2RenderingPipeline | null = null;
  private focus = 0;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {}

  apply(q: QualityPreset): void {
    this.pipeline?.dispose();
    this.ssao?.dispose();
    this.ssao = null;

    // SSAO first so ambient occlusion is applied in linear HDR, before tone mapping.
    if (q.ssao && SSAO2RenderingPipeline.IsSupported) {
      const ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: q.ssaoRatio, blurRatio: 1 }, [this.camera]);
      ssao.radius = POST.ssaoRadius;
      ssao.totalStrength = POST.ssaoStrength;
      ssao.base = POST.ssaoBase;
      ssao.samples = q.ssaoSamples;
      ssao.maxZ = POST.ssaoMaxZ;
      ssao.expensiveBlur = true;
      this.ssao = ssao;
    }

    const p = new DefaultRenderingPipeline('post', true, this.scene, [this.camera]);
    p.samples = q.msaaSamples;
    p.fxaaEnabled = q.fxaa;
    p.bloomEnabled = q.bloom;
    p.bloomThreshold = POST.bloomThreshold;
    p.bloomWeight = POST.bloomWeight;
    p.bloomKernel = POST.bloomKernel;
    p.bloomScale = POST.bloomScale;
    p.depthOfFieldEnabled = q.depthOfField;
    p.depthOfFieldBlurLevel = BLUR_LEVELS[q.dofBlurLevel];
    p.depthOfField.focalLength = POST.dofFocalLength;
    p.depthOfField.lensSize = POST.dofLensSize;
    p.depthOfField.fStop = POST.dofFStop;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = POST.exposure;
    ip.contrast = POST.contrast;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = POST.vignetteWeight;
    ip.vignetteStretch = POST.vignetteStretch;
    this.pipeline = p;
  }

  /** Keeps the focal plane on the subject; replays open the aperture for a shallower field. */
  setFocus(distance: number, replay: boolean, dt: number): void {
    const dof = this.pipeline?.depthOfField;
    if (!dof) return;
    this.focus += (distance - this.focus) * approach(dt, POST.dofFocusSmoothing);
    dof.focusDistance = this.focus * POST.millimetresPerMetre;
    dof.fStop = replay ? POST.dofReplayFStop : POST.dofFStop;
  }

  /** Jumps focus without easing (used on camera cuts). */
  snapFocus(distance: number): void {
    this.focus = distance;
  }
}
