/** 40 mm celluloid-free ball and the air it flies through. SI units. */
export const BALL = {
  radius: 0.02,
  mass: 0.0027,
  /** Thin spherical shell: I = (2/3) m r^2. */
  inertiaFactor: 2 / 3,
} as const;

export const AIR = {
  density: 1.2,
  dragCoefficient: 0.47,
  /** Lift per unit spin ratio (r * omega / v): F = 1/2 rho A r Cm (omega x v). */
  magnusCoefficient: 0.62,
  /** Seconds for spin to decay by 1/e through air friction. */
  spinDecayTime: 9,
} as const;

const crossSection = Math.PI * BALL.radius * BALL.radius;
const HALF = 0.5;

/** Acceleration = -DRAG_K * |v| * v. */
export const DRAG_K = (HALF * AIR.density * crossSection * AIR.dragCoefficient) / BALL.mass;
/** Acceleration = MAGNUS_K * (omega x v). */
export const MAGNUS_K = (HALF * AIR.density * crossSection * BALL.radius * AIR.magnusCoefficient) / BALL.mass;
export const BALL_INERTIA = BALL.inertiaFactor * BALL.mass * BALL.radius * BALL.radius;
