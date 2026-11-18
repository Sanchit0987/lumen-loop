import { TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from './table';

export const PADDLE = {
  /** Visual blade radius. */
  bladeRadius: 0.082,
  bladeThickness: 0.007,
  rubberThickness: 0.0035,
  handleLength: 0.1,
  handleWidth: 0.028,
  handleDepth: 0.022,
  /** Radius of the swept hit volume (blade plus arm-reach assist). */
  hitRadius: 0.15,
  hitHalfThickness: 0.03,
  /** Hard cap on paddle travel speed, m/s. */
  maxSpeed: 11,
  /** How fast a human player's paddle can travel: fast, wide shots can still get past it. */
  humanSpeed: 4.2,
  /** Time constant with which the paddle chases its commanded position, seconds. */
  followTime: 0.035,
  /** Time constant for the velocity estimate used as swing speed, seconds. */
  velocitySmoothing: 0.05,
  /** Time constant with which the paddle height follows the ball, seconds. */
  heightFollowTime: 0.06,
  /** Time constant for the displayed face angle, seconds. */
  faceFollowTime: 0.07,
  /** Seconds the solved face angle is held after contact. */
  faceHoldTime: 0.22,
  restHeight: TABLE.surfaceHeight + 0.2,
  minHeight: 0.5,
  maxHeight: TABLE.surfaceHeight + 0.75,
  /** Lowest paddle centre while it is over the table. */
  overTableClearance: 0.1,
  /** Lateral travel limit from the table centre line. */
  maxX: TABLE_HALF_WIDTH + 0.55,
  /** Depth limits measured from the net plane. */
  minZ: TABLE_HALF_LENGTH - 0.45,
  maxZ: TABLE_HALF_LENGTH + 0.7,
  restZ: TABLE_HALF_LENGTH + 0.3,
  /** Resting face tilt above horizontal, radians. */
  restPitch: 0.12,
} as const;

export const SERVE = {
  /** Ball rest position relative to the paddle: towards the net and upwards. */
  holdForward: 0.03,
  holdUp: 0.1,
  tossSpeed: 2.35,
  /** Server paddle depth limits while holding the ball (behind the end line). */
  minZ: TABLE_HALF_LENGTH + 0.22,
  /** The toss is abandoned and retried once the ball drops this far below the hand. */
  retryDrop: 0.3,
  paddleHeight: TABLE.surfaceHeight + 0.22,
} as const;
