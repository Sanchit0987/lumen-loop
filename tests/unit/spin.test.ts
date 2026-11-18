import { describe, expect, it } from 'vitest';
import { BALL, DRAG_K } from '../../src/config/ball';
import { PHYSICS, SURFACES } from '../../src/config/physics';
import { TABLE } from '../../src/config/table';
import { cross, dot, length, v3, UP, ZERO } from '../../src/math/vec3';
import { dragAcceleration, magnusAcceleration, spinDecay } from '../../src/physics/aero';
import { resolveContact } from '../../src/physics/contact';
import { predictFlight } from '../../src/physics/flight';
import { sidespinOf, spinVector, topspinOf } from '../../src/physics/spin';

const SPIN = 150; // rad/s, about 1400 rpm
const forward = v3(0, 0, -6);
// Starts just past the net so every variant lands on the far half.
const start = (w = v3()) => ({ p: v3(0, TABLE.surfaceHeight + 0.3, -0.1), v: v3(0, 1, -2.5), w });

describe('aerodynamics', () => {
  it('drag opposes velocity and grows with the square of speed', () => {
    const a = dragAcceleration(v3(0, 0, -5));
    const b = dragAcceleration(v3(0, 0, -10));
    expect(a.z).toBeGreaterThan(0);
    expect(a.z).toBeCloseTo(DRAG_K * 25, 6);
    expect(b.z / a.z).toBeCloseTo(4, 6);
  });

  it('Magnus force is perpendicular to spin and velocity', () => {
    const w = spinVector(forward, SPIN, 40);
    const a = magnusAcceleration(forward, w);
    expect(dot(a, forward)).toBeCloseTo(0, 6);
    expect(dot(a, w)).toBeCloseTo(0, 6);
  });

  it('topspin pushes the ball down and backspin lifts it', () => {
    expect(magnusAcceleration(forward, spinVector(forward, SPIN, 0)).y).toBeLessThan(0);
    expect(magnusAcceleration(forward, spinVector(forward, -SPIN, 0)).y).toBeGreaterThan(0);
  });

  it('spin helpers round-trip topspin and sidespin', () => {
    const w = spinVector(v3(1, 0.4, -3), 120, -35);
    expect(topspinOf(w, v3(1, 0.4, -3))).toBeCloseTo(120, 6);
    expect(sidespinOf(w)).toBeCloseTo(-35, 6);
  });

  it('spin decays slowly in the air', () => {
    expect(spinDecay(1)).toBeLessThan(1);
    expect(spinDecay(1)).toBeGreaterThan(0.8);
  });
});

describe('spin in flight', () => {
  const first = (w = v3()) => predictFlight(start(w), { maxBounces: 1 }).bounces[0];

  it('topspin dips short, backspin floats long', () => {
    const flat = first();
    const top = first(spinVector(forward, SPIN, 0));
    const back = first(spinVector(forward, -SPIN, 0));
    expect(top.p.z).toBeGreaterThan(flat.p.z + 0.05);
    expect(back.p.z).toBeLessThan(flat.p.z - 0.05);
    expect(top.t).toBeLessThan(back.t);
  });

  it('sidespin curves the ball sideways, in opposite directions for opposite spin', () => {
    const left = first(spinVector(forward, 0, SPIN));
    const right = first(spinVector(forward, 0, -SPIN));
    expect(Math.abs(first().p.x)).toBeLessThan(1e-9);
    expect(left.p.x * right.p.x).toBeLessThan(0);
    expect(Math.abs(left.p.x)).toBeGreaterThan(0.02);
    expect(left.p.x).toBeCloseTo(-right.p.x, 6);
  });

  it('drag slows the ball over the flight', () => {
    const flight = predictFlight(start(), { maxBounces: 1 });
    expect(Math.abs(flight.endState.v.z)).toBeLessThan(2.5);
  });
});

describe('spin-dependent bounce', () => {
  // Steep enough that the table can grip the ball instead of only skidding.
  const incoming = v3(0, -4, -2);
  const bounce = (topspin: number, side = 0) => resolveContact(incoming, spinVector(incoming, topspin, side), UP, ZERO, SURFACES.table);

  it('reflects the normal velocity with the table restitution', () => {
    expect(bounce(0).v.y).toBeCloseTo(4 * SURFACES.table.restitution, 6);
  });

  it('topspin kicks forward, backspin checks up', () => {
    const top = bounce(SPIN), flat = bounce(0), back = bounce(-SPIN);
    expect(-top.v.z).toBeGreaterThan(-flat.v.z);
    expect(-flat.v.z).toBeGreaterThan(-back.v.z);
    expect(-top.v.z).toBeGreaterThan(-incoming.z);
    expect(-back.v.z).toBeLessThan(-incoming.z / 2);
  });

  it('a skidding flat ball picks up topspin from table friction', () => {
    expect(topspinOf(bounce(0).w, incoming)).toBeGreaterThan(0);
  });

  it('friction never exceeds the Coulomb limit', () => {
    const out = bounce(-SPIN);
    const dvTangent = Math.hypot(out.v.x - incoming.x, out.v.z - incoming.z);
    const dvNormal = out.v.y - incoming.y;
    expect(dvTangent).toBeLessThanOrEqual(SURFACES.table.friction * dvNormal + 1e-9);
  });

  it('a rolling ball keeps its tangential speed (no slip, no friction)', () => {
    const rolling = v3(0, -3, -5);
    const w = cross(UP, v3(0, 0, -5 / BALL.radius));
    const out = resolveContact(rolling, w, UP, ZERO, SURFACES.table);
    expect(out.v.z).toBeCloseTo(-5, 6);
    expect(length(out.w)).toBeCloseTo(length(w), 6);
  });

  it('sidespin kicks the ball sideways off the table', () => {
    // Pure rotation about the vertical axis has no contact-point velocity; tilt the axis slightly.
    const w = v3(0, 0, -SPIN);
    const out = resolveContact(incoming, w, UP, ZERO, SURFACES.table);
    expect(Math.abs(out.v.x)).toBeGreaterThan(0.3);
  });

  it('ignores a ball that is already separating', () => {
    const leaving = v3(0, 2, -5);
    expect(resolveContact(leaving, v3(), UP, ZERO, SURFACES.table).v).toEqual(leaving);
  });
});

describe('paddle friction', () => {
  const ballIn = v3(0, 0, 4);
  const face = v3(0, 0, -1);

  it('an upward brush produces topspin, a downward brush backspin', () => {
    const up = resolveContact(ballIn, v3(), face, v3(0, 5, -3), SURFACES.paddle);
    const down = resolveContact(ballIn, v3(), face, v3(0, -5, -3), SURFACES.paddle);
    expect(topspinOf(up.w, up.v)).toBeGreaterThan(100);
    expect(topspinOf(down.w, down.v)).toBeLessThan(-100);
    expect(up.v.y).toBeGreaterThan(0);
  });

  it('a sideways brush produces sidespin', () => {
    const out = resolveContact(ballIn, v3(), face, v3(4, 0, -3), SURFACES.paddle);
    expect(Math.abs(sidespinOf(out.w))).toBeGreaterThan(100);
  });

  it('a faster swing returns a faster ball', () => {
    const slow = resolveContact(ballIn, v3(), face, v3(0, 0, -2), SURFACES.paddle);
    const fast = resolveContact(ballIn, v3(), face, v3(0, 0, -7), SURFACES.paddle);
    expect(length(fast.v)).toBeGreaterThan(length(slow.v) + 5);
  });

  it('incoming topspin climbs off a passive paddle, backspin drops', () => {
    const top = resolveContact(ballIn, spinVector(ballIn, SPIN, 0), face, v3(), SURFACES.paddle);
    const back = resolveContact(ballIn, spinVector(ballIn, -SPIN, 0), face, v3(), SURFACES.paddle);
    expect(top.v.y).toBeGreaterThan(0.5);
    expect(back.v.y).toBeLessThan(-0.5);
  });

  it('timestep is fixed and fine enough for a fast ball', () => {
    const fastest = 30;
    expect(fastest * PHYSICS.timestep).toBeLessThan(0.15);
    expect(PHYSICS.timestep).toBe(1 / 240);
  });
});
