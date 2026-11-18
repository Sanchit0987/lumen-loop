/** Match flow timings in seconds. */
export const FLOW = {
  /** Pause between a point ending and the next serve being set up. */
  pointPause: 1.7,
  gamePause: 3.4,
  /** Earliest moment after setup that a serve toss is accepted. */
  serveMinDelay: 0.45,
  /** Time after the toss before the server may strike the ball. */
  tossMinFlight: 0.16,
  /** A rally with no contact for this long is declared dead. */
  deadBallTime: 3.2,
  /** Extra seconds kept after the deciding contact in a replay. */
  letPause: 1.1,
  /** Longest real frame time fed to the simulation, seconds (longer frames slow the game down). */
  maxFrameTime: 0.1,
  /** Seconds a HUD banner / stroke label stays up. */
  bannerTime: 1.6,
  strokeLabelTime: 0.9,
  /** Seconds between FPS read-out refreshes. */
  fpsInterval: 0.5,
} as const;

export const REPLAY = {
  /** Snapshots stored per second of simulation time. */
  sampleRate: 60,
  /** Seconds of play kept in the ring buffer. */
  bufferSeconds: 6,
  /** Seconds before the final paddle hit at which the replay starts. */
  leadIn: 1.1,
  /** Seconds after the point was decided at which the replay ends. */
  leadOut: 0.9,
  /** Playback rate of the slow motion. */
  timeScale: 0.33,
  /** Seconds of replay time each camera angle is held before cutting. */
  cutInterval: 0.75,
  /** Delay between the match point ending and the replay starting. */
  startDelay: 1.2,
} as const;

export interface ReplayCamera {
  /** Camera position in metres. */
  position: readonly [number, number, number];
  /** 0 = look at the table centre, 1 = track the ball. */
  follow: number;
}

/** Camera angles cut between during a slow-motion replay. */
export const REPLAY_CAMERAS: readonly ReplayCamera[] = [
  { position: [3.3, 1.45, 0.5], follow: 0.75 },
  { position: [-1.1, 1.2, -3.2], follow: 0.6 },
  { position: [-2.7, 1.05, 1.5], follow: 0.9 },
  { position: [0.9, 3.4, 2.4], follow: 0.4 },
];

/** Height of the point replays and orbits look at when not tracking the ball. */
export const REPLAY_LOOK_HEIGHT = 0.9;
