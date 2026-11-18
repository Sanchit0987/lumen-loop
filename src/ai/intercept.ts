import { AI } from '../config/ai';
import { PADDLE } from '../config/paddle';
import { TABLE, TABLE_HALF_LENGTH } from '../config/table';
import type { Flight, FlightSample } from '../physics/flight';
import type { PlayerIndex } from '../physics/types';
import { sideSign } from '../stroke/swing';

/**
 * Samples of a predicted flight in which `player` may legally strike the ball: after its bounce on
 * their half and before the next bounce. `bounced` says that bounce already happened before the
 * prediction was made.
 */
export function playableSamples(flight: Flight, player: PlayerIndex, bounced: boolean): FlightSample[] {
  let from = 0;
  let next = 0;
  if (!bounced) {
    const index = flight.bounces.findIndex((b) => b.side === player);
    if (index < 0) return [];
    from = flight.bounces[index].t;
    next = index + 1;
  }
  const until = flight.bounces[next]?.t ?? Infinity;
  return flight.samples.filter((s) => s.t > from && s.t < until);
}

/**
 * Chooses where to meet the ball: the playable sample closest to the preferred distance behind the
 * end line, penalising contact points that are too low or too high to swing at comfortably.
 */
export function pickIntercept(flight: Flight, player: PlayerIndex, standOff: number, bounced: boolean): FlightSample | null {
  const sign = sideSign(player);
  const preferred = TABLE_HALF_LENGTH + standOff;
  let best: FlightSample | null = null;
  let bestCost = Infinity;
  for (const s of playableSamples(flight, player, bounced)) {
    const depth = s.p.z * sign;
    if (depth < PADDLE.minZ || depth > PADDLE.maxZ || Math.abs(s.p.x) > PADDLE.maxX) continue;
    const h = s.p.y - TABLE.surfaceHeight;
    if (s.p.y < AI.absoluteMinHeight) continue;
    const heightMiss = Math.max(0, AI.minContactHeight - h) + Math.max(0, h - AI.maxContactHeight);
    const cost = Math.abs(depth - preferred) + heightMiss * AI.lowContactPenalty;
    if (cost < bestCost) { bestCost = cost; best = s; }
  }
  return best;
}

/** Predicted ball state where the flight passes depth `z` on `player`'s side while it is playable. */
export function sampleAtDepth(flight: Flight, player: PlayerIndex, z: number, bounced: boolean): FlightSample | null {
  const sign = sideSign(player);
  const samples = playableSamples(flight, player, bounced);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if ((a.p.z - z) * sign <= 0 && (b.p.z - z) * sign >= 0) return b;
  }
  return null;
}

/** Height of the ball where the predicted flight passes depth `z` after bouncing on `player`'s side. */
export const heightAtDepth = (flight: Flight, player: PlayerIndex, z: number, bounced: boolean): number | null =>
  sampleAtDepth(flight, player, z, bounced)?.p.y ?? null;
