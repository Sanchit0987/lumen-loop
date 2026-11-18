import { BALL } from '../config/ball';
import { SURFACES } from '../config/physics';
import { SOLVER, STROKE } from '../config/stroke';
import { NET_TOP, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../config/table';
import { clamp, mix, normalize, scale, v3, type Vec3 } from '../math/vec3';
import { resolveContact } from '../physics/contact';
import { predictFlight } from '../physics/flight';
import { sideOfZ, type BallState, type PlayerIndex } from '../physics/types';
import type { SolvedStroke, StrokeIntent } from './intent';

interface Candidate {
  cost: number;
  legal: boolean;
  landing: Vec3 | null;
  /** Landing point, or where the flight ended when it never bounced. */
  reached: Vec3;
}

/** Unit face normal from yaw (about +Y, relative to `heading`) and pitch (positive = open). */
export function faceNormal(heading: number, yaw: number, pitch: number): Vec3 {
  const a = heading + yaw;
  const c = Math.cos(pitch);
  return v3(Math.sin(a) * c, Math.sin(pitch), Math.cos(a) * c);
}

/** Paddle velocity for an intent: forward along `heading`, tilted up/down and sideways to brush. */
export function swingVelocity(heading: number, intent: StrokeIntent, speedScale: number, brushScale = 1): Vec3 {
  const lo = intent.isServe ? STROKE.serveMinSpeed : STROKE.minSpeed;
  const hi = intent.isServe ? STROKE.serveMaxSpeed : STROKE.maxSpeed;
  const speed = mix(lo, hi, intent.power) * speedScale;
  const lift = (intent.isServe ? STROKE.serveTopspinBrushScale : 1) * brushScale;
  const elevation = intent.topspin * (intent.topspin >= 0 ? STROKE.topspinBrushAngle * lift : STROKE.backspinBrushAngle * brushScale);
  const a = heading + intent.sidespin * STROKE.sidespinBrushAngle;
  const c = Math.cos(elevation);
  return v3(Math.sin(a) * c * speed, Math.sin(elevation) * speed, Math.cos(a) * c * speed);
}

function evaluate(ball: BallState, normal: Vec3, velocity: Vec3, intent: StrokeIntent, hitter: PlayerIndex): Candidate {
  const out = resolveContact(ball.v, ball.w, normal, velocity, SURFACES.paddle);
  const bouncesNeeded = intent.isServe ? 2 : 1;
  const flight = predictFlight({ p: ball.p, v: out.v, w: out.w }, { maxBounces: bouncesNeeded });
  const landing = flight.bounces[bouncesNeeded - 1]?.p ?? null;
  const first = flight.bounces[0];
  let legal = flight.end === 'bounces' && landing !== null && sideOfZ(landing.z) !== hitter
    && (flight.netCrossY ?? 0) - BALL.radius > NET_TOP + SOLVER.netClearance - BALL.radius
    && Math.abs(landing.x) < TABLE_HALF_WIDTH - SOLVER.edgeMargin
    && Math.abs(landing.z) < TABLE_HALF_LENGTH - SOLVER.edgeMargin;
  if (intent.isServe && first) {
    const depth = Math.abs(first.p.z);
    legal = legal && sideOfZ(first.p.z) === hitter
      && depth > SOLVER.serveBounceMargin && depth < TABLE_HALF_LENGTH - SOLVER.serveBounceMargin;
  }
  // Without a bounce, fall back to where the flight ended so the search still has a gradient.
  const reached = landing ?? flight.endState.p;
  const error = Math.hypot(reached.z - intent.target.z, reached.x - intent.target.x);
  const lob = Math.max(0, (flight.netCrossY ?? NET_TOP) - NET_TOP - SOLVER.flatClearance) * SOLVER.lobWeight;
  return { cost: error + lob + (legal ? 0 : SOLVER.invalidPenalty), legal, landing, reached };
}

/**
 * Finds the face angle that sends the believed ball to the intent's target using the same contact
 * and flight models as the simulation. If no legal shot exists at the requested swing speed the
 * swing speed is rescaled through `SOLVER.*SpeedScales`.
 */
export function solveStroke(ball: BallState, intent: StrokeIntent, hitter: PlayerIndex): SolvedStroke {
  const believed: BallState = { p: ball.p, v: ball.v, w: scale(ball.w, intent.spinRead) };
  const heading = Math.atan2(intent.target.x - ball.p.x, intent.target.z - ball.p.z);
  let best: SolvedStroke | null = null;
  let bestCost = Infinity;
  const scales = intent.isServe ? SOLVER.serveSpeedScales : SOLVER.rallySpeedScales;
  const attempts = SOLVER.brushScales.flatMap((brush) => scales.map((speed) => ({ brush, speed })));
  for (const attempt of attempts) {
    const velocity = swingVelocity(heading, intent, attempt.speed, attempt.brush);
    let yaw = 0;
    for (let iter = 0; iter < SOLVER.yawIterations; iter++) {
      const found = searchPitch(believed, heading, yaw, velocity, intent, hitter);
      if (found.cost < bestCost) {
        bestCost = found.cost;
        best = { normal: faceNormal(heading, yaw, found.pitch), velocity, pitch: found.pitch, yaw, legal: found.legal, landing: found.landing };
      }
      const probe = evaluate(believed, faceNormal(heading, yaw + SOLVER.yawProbe, found.pitch), velocity, intent, hitter);
      // Newton step on the lateral miss, measured across the line from ball to target.
      const lateral = (p: Vec3): number => (p.x - intent.target.x) * Math.cos(heading) - (p.z - intent.target.z) * Math.sin(heading);
      const slope = (lateral(probe.reached) - lateral(found.reached)) / SOLVER.yawProbe;
      if (Math.abs(slope) < Number.EPSILON) break;
      yaw = clamp(yaw - lateral(found.reached) / slope, -SOLVER.maxYaw, SOLVER.maxYaw);
    }
    if (best?.legal && bestCost < SOLVER.acceptCost) break;
  }
  return best ?? { normal: normalize(v3(0, 0, hitter === 0 ? -1 : 1)), velocity: v3(), pitch: 0, yaw: 0, legal: false, landing: null };
}

function searchPitch(ball: BallState, heading: number, yaw: number, velocity: Vec3, intent: StrokeIntent, hitter: PlayerIndex) {
  let lo = SOLVER.minPitch;
  let hi = SOLVER.maxPitch;
  let steps: number = SOLVER.coarseSteps;
  let best = { pitch: 0, cost: Infinity, legal: false, landing: null as Vec3 | null, reached: ball.p };
  for (let pass = 0; pass <= SOLVER.refinePasses; pass++) {
    const span = (hi - lo) / steps;
    for (let i = 0; i <= steps; i++) {
      const pitch = lo + span * i;
      const c = evaluate(ball, faceNormal(heading, yaw, pitch), velocity, intent, hitter);
      // Strict comparison keeps the flattest of equally good trajectories.
      if (c.cost < best.cost) best = { pitch, ...c };
    }
    lo = Math.max(SOLVER.minPitch, best.pitch - span);
    hi = Math.min(SOLVER.maxPitch, best.pitch + span);
    steps = SOLVER.fineSteps;
  }
  return best;
}
