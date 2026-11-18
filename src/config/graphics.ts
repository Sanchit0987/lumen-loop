export type Quality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Cap on device pixel ratio; render resolution = CSS size * min(dpr, cap). */
  maxPixelRatio: number;
  msaaSamples: number;
  fxaa: boolean;
  shadowMapSize: number;
  /** Soft contact-hardening (PCSS) shadows instead of plain PCF. */
  contactHardening: boolean;
  ssao: boolean;
  ssaoRatio: number;
  ssaoSamples: number;
  bloom: boolean;
  depthOfField: boolean;
  /** 0 = low, 1 = medium, 2 = high blur kernel. */
  dofBlurLevel: 0 | 1 | 2;
  crowdRows: number;
  anisotropy: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: {
    maxPixelRatio: 1, msaaSamples: 1, fxaa: true, shadowMapSize: 1024, contactHardening: false,
    ssao: false, ssaoRatio: 0.5, ssaoSamples: 8, bloom: false, depthOfField: false, dofBlurLevel: 0,
    crowdRows: 3, anisotropy: 2,
  },
  medium: {
    maxPixelRatio: 1.25, msaaSamples: 1, fxaa: true, shadowMapSize: 2048, contactHardening: false,
    ssao: true, ssaoRatio: 0.5, ssaoSamples: 8, bloom: true, depthOfField: true, dofBlurLevel: 0,
    crowdRows: 5, anisotropy: 4,
  },
  high: {
    maxPixelRatio: 2, msaaSamples: 4, fxaa: true, shadowMapSize: 4096, contactHardening: true,
    ssao: true, ssaoRatio: 0.75, ssaoSamples: 16, bloom: true, depthOfField: true, dofBlurLevel: 1,
    crowdRows: 7, anisotropy: 8,
  },
};

export const DEFAULT_QUALITY: Quality = 'medium';

export const CAMERA = {
  /** Vertical field of view in radians for landscape screens. */
  fov: 0.6,
  /** Aspect ratio below which the field of view widens to keep the table in frame. */
  wideAspect: 1.5,
  maxFov: 1.25,
  near: 0.08,
  far: 90,
  /** Resting position behind player 0: height above the floor and distance from the net. */
  height: 2.75,
  distance: 4.35,
  /** Point the camera looks at. */
  lookHeight: 0.7,
  lookDepth: -0.25,
  /** How far the camera slides sideways with the paddle and looks towards the ball. */
  followPaddleX: 0.25,
  followBallX: 0.3,
  followBallZ: 0.07,
  followBallY: 0.12,
  /** Time constants (seconds) for camera position and aim smoothing. */
  positionSmoothing: 0.28,
  aimSmoothing: 0.16,
  /** Menu attract-mode orbit. */
  orbitRadius: 5.6,
  orbitHeight: 2.5,
  orbitSpeed: 0.11,
  orbitLookHeight: 0.85,
} as const;

export const LIGHTS = {
  environmentIntensity: 1.0,
  keyIntensity: 3.4,
  keyDirection: [-0.5, -1, -0.34],
  keyHeight: 9,
  fillIntensity: 0.6,
  /** Half-size of the orthographic shadow frustum around the table, metres. */
  shadowExtent: 4.2,
  shadowDarkness: 0.28,
  shadowBias: 0.0012,
  shadowNormalBias: 0.012,
  shadowSoftness: 0.035,
  /** Shadow maps larger than this use the higher PCF sample count. */
  sharpShadowMapSize: 1024,
  /** Emissive strength of the overhead light panels (drives bloom). */
  panelEmissive: 5.5,
  panelCount: 5,
  panelSpacing: 2.6,
  panelWidth: 0.9,
  panelLength: 1.9,
  trussThickness: 0.12,
} as const;

export const POST = {
  exposure: 1.25,
  contrast: 1.14,
  bloomThreshold: 0.86,
  bloomWeight: 0.26,
  bloomKernel: 56,
  bloomScale: 0.5,
  ssaoRadius: 1.1,
  ssaoStrength: 1.05,
  ssaoBase: 0.12,
  ssaoMaxZ: 40,
  /** Depth of field lens (subtle): millimetres and f-stop. */
  dofFocalLength: 62,
  dofLensSize: 50,
  dofFStop: 3.4,
  /** Stronger blur used for slow-motion replays. */
  dofReplayFStop: 1.8,
  dofFocusSmoothing: 0.2,
  vignetteWeight: 1.7,
  vignetteStretch: 0.2,
  millimetresPerMetre: 1000,
} as const;

/** sRGB hex colours; converted to linear when materials are built. */
export const COLOURS = {
  tableTop: '#14507a',
  tableLine: '#f2f4f1',
  tableEdge: '#0d2f47',
  tableSteel: '#2b3138',
  netMesh: '#10151b',
  netTape: '#f4f4f0',
  ball: '#fff6e8',
  ballMark: '#e2531f',
  rubberFore: '#c81f2c',
  rubberBack: '#15161a',
  floor: '#a8433f',
  floorOuter: '#3a404a',
  barrier: '#12314a',
  barrierText: '#ffc247',
  wall: '#0b0e13',
  stand: '#1c2028',
  panel: '#fff3dc',
  robotGrey: '#c9ced6',
  robotDark: '#1b1e24',
  clear: '#06080b',
} as const;

export const SURFACE_LOOK = {
  tableRoughness: 0.42,
  varnishIntensity: 0.9,
  varnishRoughness: 0.14,
  /** Opacity of the wood grain blended over the painted table top. */
  grainOpacity: 0.5,
  grainBump: 0.35,
  tableTextureWidth: 1024,
  tableTextureHeight: 2048,
  rubberRoughness: 0.78,
  rubberBump: 1.4,
  rubberTiling: 5,
  ballRoughness: 0.62,
  floorRoughness: 0.72,
  floorTiling: 9,
  floorBump: 0.7,
  woodTiling: 1.5,
  robotRoughness: 0.45,
  robotMetallic: 0.25,
} as const;

/** Ring drawn where the incoming ball will bounce on the player's half. */
export const MARKER = {
  radius: 0.075,
  thickness: 0.012,
  lift: 0.003,
  colour: '#ffd35a',
  emissive: 1.6,
  alpha: 0.85,
  tessellation: 40,
} as const;

export const CROWD = {
  textureWidth: 1024,
  textureHeight: 128,
  peoplePerRow: 16,
  blurPixels: 3,
  rowHeight: 0.95,
  brightness: 0.55,
  /** Hue anchors (degrees) for clothing colours. */
  hues: [8, 28, 200, 215, 265, 340, 150],
} as const;

export const ATHLETE = {
  height: 1.15,
  /** Where the body stands relative to the paddle: to the non-playing side and behind. */
  sideOffset: 0.42,
  backOffset: 0.36,
  /** Closest the body may stand to the net plane (keeps it out of the table). */
  minDepthClearance: 0.3,
  /** Time constant with which the body follows the paddle, seconds. */
  followTime: 0.14,
  /** Forward lean (radians) used to reach over the table, and the distance that maps to it. */
  maxLean: 0.5,
  leanDistance: 0.55,
  /** Hip/torso twist (radians) per m/s of sideways paddle swing, and its cap. */
  twistPerSpeed: 0.08,
  maxTwist: 0.55,
  twistSmoothing: 0.08,
  /** Foot speed (m/s) at which the run cycle is fully blended in. */
  runSpeed: 1.4,
  blendTime: 0.15,
  /** Distance from the blade centre to where the hand grips the handle. */
  gripOffset: 0.13,
  /** Elbow pole direction in body space (out to the side, down and slightly back). */
  elbowPole: [0.75, -0.6, 0.25],
  reachSlack: 0.995,
  /** Handle direction before projection into the blade plane: outwards, down, towards the body. */
  gripDirection: [0.35, -1, 0.25],
  /** Opacity of the near-side athlete in the play camera, so it never hides the table. */
  nearOpacity: 0.32,
  opacityFadeTime: 0.2,
  opaqueAbove: 0.98,
  model: 'models/robot_expressive.glb',
  clips: { idle: 'Idle', run: 'Running', win: 'Jump', cheer: 'ThumbsUp', lose: 'No', agree: 'Yes' },
  bones: { upperArm: 'UpperArm.R', lowerArm: 'LowerArm.R', hand: 'Palm2.R', torso: 'Torso', hips: 'Hips' },
  tintMaterial: 'Main',
} as const;
