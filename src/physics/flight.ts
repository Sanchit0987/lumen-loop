import { BALL } from '../config/ball';
import { PHYSICS, PREDICTION, SURFACES } from '../config/physics';
import { NET_HALF_WIDTH, NET_TOP, TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../config/table';
import { copy, UP, ZERO, type Vec3 } from '../math/vec3';
import { flightAcceleration, spinDecay } from './aero';
import { resolveContact } from './contact';
import { sideOfZ, type BallState, type PlayerIndex } from './types';

export interface Bounce {
  t: number;
  p: Vec3;
  side: PlayerIndex;
}

export interface FlightSample extends BallState {
  t: number;
}

export type FlightEnd = 'bounces' | 'floor' | 'net' | 'time';

export interface Flight {
  bounces: Bounce[];
  /** Height of the ball centre when it crossed the net plane, if it did. */
  netCrossY: number | null;
  netHit: boolean;
  samples: FlightSample[];
  end: FlightEnd;
  endState: BallState;
  duration: number;
}

export interface FlightOptions {
  maxBounces?: number;
  maxTime?: number;
  /** Record trajectory samples (off for the stroke solver's inner loop). */
  record?: boolean;
}

const SURFACE_Y = TABLE.surfaceHeight + BALL.radius;

/**
 * Integrates free flight with the same semi-implicit Euler step, forces and bounce model as the
 * Rapier world, using analytic planes for the table, net and floor. Pure and allocation-light.
 */
export function predictFlight(start: BallState, options: FlightOptions = {}): Flight {
  const maxBounces = options.maxBounces ?? PREDICTION.maxTableBounces;
  const maxTime = options.maxTime ?? PREDICTION.maxTime;
  const dt = PHYSICS.timestep;
  const decay = spinDecay(dt);
  const p = copy(start.p);
  let v = copy(start.v);
  let w = copy(start.w);
  const flight: Flight = {
    bounces: [], netCrossY: null, netHit: false, samples: [], end: 'time',
    endState: { p, v, w }, duration: 0,
  };
  let t = 0;
  for (let step = 0; t < maxTime; step++) {
    const a = flightAcceleration(v, w);
    v.x += a.x * dt; v.y += a.y * dt; v.z += a.z * dt;
    const prevX = p.x, prevY = p.y, prevZ = p.z;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    w.x *= decay; w.y *= decay; w.z *= decay;
    t += dt;

    if (prevZ !== p.z && prevZ * p.z <= 0) {
      const f = prevZ / (prevZ - p.z);
      const y = prevY + (p.y - prevY) * f;
      const x = prevX + (p.x - prevX) * f;
      flight.netCrossY = y;
      const blocked = y - BALL.radius < NET_TOP && y > TABLE.surfaceHeight - TABLE.thickness
        && Math.abs(x) < NET_HALF_WIDTH + BALL.radius;
      if (blocked) { flight.netHit = true; flight.end = 'net'; break; }
    }

    const overTable = Math.abs(p.x) <= TABLE_HALF_WIDTH && Math.abs(p.z) <= TABLE_HALF_LENGTH;
    if (v.y < 0 && p.y <= SURFACE_Y && prevY > SURFACE_Y - BALL.radius && overTable) {
      const out = resolveContact(v, w, UP, ZERO, SURFACES.table);
      v = copy(out.v); w = copy(out.w);
      p.y = SURFACE_Y + PHYSICS.contactSkin;
      flight.bounces.push({ t, p: copy(p), side: sideOfZ(p.z) });
      if (flight.bounces.length >= maxBounces) { flight.end = 'bounces'; break; }
    } else if (p.y <= BALL.radius) {
      flight.end = 'floor';
      break;
    }
    if (options.record && step % PREDICTION.sampleStride === 0) {
      flight.samples.push({ t, p: copy(p), v: copy(v), w: copy(w) });
    }
  }
  flight.endState = { p, v, w };
  flight.duration = t;
  return flight;
}
