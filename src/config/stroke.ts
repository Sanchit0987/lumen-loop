import { TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from './table';

const DEG = Math.PI / 180;

export const STROKE = {
  /** Paddle speed at power 0 and power 1, m/s. */
  minSpeed: 1.3,
  maxSpeed: 8.5,
  serveMinSpeed: 2.5,
  serveMaxSpeed: 5.2,
  /** Brush elevation of the swing path at full topspin / full backspin. */
  topspinBrushAngle: 62 * DEG,
  backspinBrushAngle: 48 * DEG,
  /** Serves are struck downwards onto the server's half, so the upward topspin brush is flattened. */
  serveTopspinBrushScale: 0.3,
  /** Sideways brush angle at full sidespin. */
  sidespinBrushAngle: 38 * DEG,
  /** Target landing depth from the net at power 0 and 1. */
  shortDepth: 0.72,
  deepDepth: 1.12,
  serveShortDepth: 0.55,
  serveDeepDepth: 1.05,
  /** Keep aim targets this far inside the side lines. */
  sideMargin: 0.1,
  maxTargetX: TABLE_HALF_WIDTH - 0.1,
  minDepth: 0.3,
  maxDepth: TABLE_HALF_LENGTH - 0.12,
} as const;

export const SOLVER = {
  /** Face pitch search range (negative = closed, facing down). */
  minPitch: -62 * DEG,
  maxPitch: 78 * DEG,
  coarseSteps: 20,
  fineSteps: 6,
  refinePasses: 2,
  yawIterations: 3,
  yawProbe: 2 * DEG,
  maxYaw: 50 * DEG,
  /** Required clearance of the ball centre over the net tape. */
  netClearance: 0.035,
  /** Landing must be this far inside the table edges to count as safe. */
  edgeMargin: 0.03,
  /** Swing-speed scales tried in order until a legal shot is found. */
  rallySpeedScales: [1, 0.84, 1.2, 0.7, 1.45, 0.58, 1.8, 0.48, 2.3, 0.4],
  /** If no swing speed works, the brush is flattened through these scales (less spin, safer contact). */
  brushScales: [1, 0.55, 0.2],
  serveSpeedScales: [1, 1.15, 0.87, 1.32, 0.76, 1.5, 0.66],
  /** Cost per metre of net clearance beyond `flatClearance`, so flat shots beat lobs. */
  lobWeight: 0.6,
  flatClearance: 0.12,
  /** A serve's first bounce must be at least this far from the net and the end line. */
  serveBounceMargin: 0.3,
  /** Penalty (metres of equivalent error) for candidate shots that are not legal. */
  invalidPenalty: 10,
  /** Stop trying other swing speeds once a legal candidate costs less than this. */
  acceptCost: 0.22,
} as const;

/** Mapping from a human swing to stroke intent. */
export const SWING = {
  /** Forward paddle speed below which the stroke is a passive block, m/s. */
  blockSpeed: 0.8,
  /** Power of a stroke played with no swing at all: a gentle, safe push rather than a dead block. */
  minPower: 0.2,
  /** Risk of hitting hard: landing scatter (metres, one sigma) at full power, growing with power squared. */
  powerScatter: 0.17,
  /** Forward paddle speed that maps to full power, m/s. */
  fullPowerSpeed: 6,
  /** Floor on forward speed when measuring swing angle, to keep blocks stable. */
  angleFloorSpeed: 1.2,
  maxAngle: 50 * DEG,
  /** Lateral landing offset produced by a swing at maxAngle, metres. */
  aimReach: 0.72,
  /** How much of the ball's lateral offset carries into the default target. */
  crossCarry: 0.25,
  sidespinGain: 0.9,
  autoBackspin: -0.4,
  autoTopspin: 0.6,
  loopTopspinBase: 0.7,
  loopTopspinGain: 0.3,
  chopBackspin: -0.95,
  /** Human assist: fraction of incoming spin the auto-angled face compensates for (1 = all of it). */
  spinRead: 1,
  serveTopspin: 0.25,
} as const;
