/** Pointer, touch and keyboard mapping. Screen fractions are 0..1 of the canvas. */
export const INPUT = {
  /**
   * Aim assist: the paddle is pulled towards the ball's predicted line. Full strength while the
   * cursor is within `assistCore * assistReach` of that line, fading to nothing at `assistReach`.
   */
  assistReach: 0.6,
  assistStrength: 0.85,
  assistCore: 0.5,
  /** Swing speed is read from cursor motion on screen: metres per full screen width / height. */
  swingMetresPerWidth: 3.2,
  swingMetresPerHeight: 2.6,
  /** Smoothing of the measured swing, how long a finished flick still counts, and its fade-out (s). */
  swingSmoothing: 0.05,
  swingHold: 0.06,
  swingDecay: 0.09,
  /** Keyboard aim assist: the paddle drifts onto the ball's predicted line when it is this close. */
  keyAssistReach: 0.45,
  keyAssistTime: 0.08,
  /** Touch drags are relative: metres of paddle travel per full screen width / height. */
  touchMetresPerWidth: 3.2,
  touchMetresPerHeight: 2.6,
  /** Keyboard paddle speeds, m/s. */
  keyStrafeSpeed: 2.6,
  keySwingSpeed: 5.5,
  keyRetreatSpeed: 2.4,
} as const;

export const KEYS = {
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  /** Player 1 (near side) keyboard alternative. */
  p1: { left: 'KeyA', right: 'KeyD', forward: 'KeyW', back: 'KeyS', toss: 'Space', loop: 'KeyF', chop: 'KeyG' },
  /** Player 2 (far side): "forward" is towards the net, which is down the screen for them. */
  p2: { left: 'ArrowLeft', right: 'ArrowRight', forward: 'ArrowDown', back: 'ArrowUp', toss: 'Enter', loop: 'Period', chop: 'Comma' },
} as const;

export type KeyMap = (typeof KEYS)['p1'] | (typeof KEYS)['p2'];
