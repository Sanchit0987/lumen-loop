export interface SurfaceParams {
  /** Normal coefficient of restitution. */
  restitution: number;
  /** Coulomb friction limit for the tangential impulse. */
  friction: number;
  /** Tangential restitution when the surface grips (0 = pure rolling, >0 = elastic rubber). */
  tangentialRestitution: number;
}

export const PHYSICS = {
  /** Fixed simulation step in seconds (240 Hz). */
  timestep: 1 / 240,
  /** Upper bound on simulation steps per rendered frame, to avoid a spiral of death. */
  maxStepsPerFrame: 12,
  gravity: 9.81,
  /** Gap left between ball and surface after a resolved contact. */
  contactSkin: 0.0005,
  /**
   * Impacts are caught this far from the surface. It must exceed Rapier's contact prediction
   * distance (2 mm), otherwise Rapier's soft contact solver brakes the ball just before the bounce.
   */
  sweepMargin: 0.003,
  /** Below this approach speed a contact is treated as resting. */
  restSpeed: 0.05,
  /** Tangential speeds below this are treated as no slip. */
  slipEpsilon: 1e-6,
  /** Contact normals flatter than this are side or edge hits, not playing-surface bounces. */
  topFaceNormalY: 0.7,
  floorHalfThickness: 0.05,
  /**
   * Rapier caps a body's rotation at a quarter turn per step (about 188 rad/s at 240 Hz), far below
   * a real loop's 900 rad/s. Spin above this fraction of that cap is carried by PhysicsWorld itself.
   */
  solverSpinFraction: 0.95,
} as const;

export const SURFACES: Record<'table' | 'net' | 'floor' | 'paddle', SurfaceParams> = {
  table: { restitution: 0.88, friction: 0.24, tangentialRestitution: 0 },
  net: { restitution: 0.12, friction: 0.5, tangentialRestitution: 0 },
  floor: { restitution: 0.7, friction: 0.45, tangentialRestitution: 0 },
  paddle: { restitution: 0.72, friction: 1.15, tangentialRestitution: 0.3 },
};

export const PREDICTION = {
  /** Longest flight the predictor will integrate, seconds. */
  maxTime: 2.2,
  maxTableBounces: 3,
  /** Keep every n-th integration step as a trajectory sample. */
  sampleStride: 4,
} as const;
