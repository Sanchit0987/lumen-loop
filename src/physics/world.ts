import RAPIER from '@dimforge/rapier3d-compat';
import { BALL, BALL_INERTIA } from '../config/ball';
import { PADDLE } from '../config/paddle';
import { PHYSICS, SURFACES, type SurfaceParams } from '../config/physics';
import { ARENA, NET, NET_HALF_WIDTH, TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../config/table';
import { add, addScaled, copy, dot, length, scale, v3, ZERO, type Vec3 } from '../math/vec3';
import { aeroAcceleration, spinDecay } from './aero';
import { resolveContact } from './contact';
import type { BallState, PlayerIndex } from './types';

export type SurfaceKind = 'table' | 'net' | 'floor' | 'paddle';

export interface ContactEvent {
  kind: SurfaceKind;
  point: Vec3;
  normal: Vec3;
  /** Closing speed along the contact normal, m/s. */
  speed: number;
  player?: PlayerIndex;
  /** True for bounces on the playing surface (not table edges or sides). */
  topFace?: boolean;
}

export interface PaddleBody {
  player: PlayerIndex;
  position: Vec3;
  velocity: Vec3;
  /** Whether this paddle may strike the ball right now. */
  canHit: boolean;
}

/** Supplies the striking surface (unit normal and velocity) for a paddle contact, or null to ignore it. */
export type StrokeResolver = (player: PlayerIndex, ball: BallState) => { normal: Vec3; velocity: Vec3 } | null;

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
/** Rotates a Y-axis cylinder so its axis lies along Z (the hitting direction). */
const AXIS_Z = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

let ready: Promise<void> | null = null;
export const initPhysics = (): Promise<void> => (ready ??= RAPIER.init());

/**
 * Rapier world holding the ball (dynamic, CCD), table, net and floor (fixed) and two paddles
 * (kinematic sensors). Each fixed step applies drag and Magnus as forces, then uses Rapier's
 * continuous shape casts to find the first impact inside the step and resolves it with the
 * spin-aware contact model. Rapier's own solver remains active for resting and rolling contact.
 */
export class PhysicsWorld {
  private readonly world: RAPIER.World;
  private readonly ball: RAPIER.RigidBody;
  private readonly ballShape = new RAPIER.Ball(BALL.radius);
  private readonly statics: { collider: RAPIER.Collider; kind: SurfaceKind; surface: SurfaceParams }[] = [];
  private readonly paddles: { body: RAPIER.RigidBody; collider: RAPIER.Collider }[] = [];
  private held = false;
  /** Authoritative ball spin: Rapier clamps angular velocity, so fast spin is tracked here. */
  private spin: Vec3 = v3();
  private readonly solverSpinLimit = (PHYSICS.solverSpinFraction * Math.PI) / (4 * PHYSICS.timestep);

  static async create(): Promise<PhysicsWorld> {
    await initPhysics();
    return new PhysicsWorld();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.timestep;
    const half = TABLE.thickness / 2;
    this.addStatic('table', v3(0, TABLE.surfaceHeight - half, 0), v3(TABLE_HALF_WIDTH, half, TABLE_HALF_LENGTH));
    this.addStatic('net', v3(0, TABLE.surfaceHeight + NET.height / 2, 0), v3(NET_HALF_WIDTH, NET.height / 2, NET.thickness / 2));
    this.addStatic('floor', v3(0, -PHYSICS.floorHalfThickness, 0), v3(ARENA.floorHalfSize, PHYSICS.floorHalfThickness, ARENA.floorHalfSize));

    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, TABLE.surfaceHeight + 1, 0).setCcdEnabled(true).setCanSleep(false),
    );
    const inertia = { x: BALL_INERTIA, y: BALL_INERTIA, z: BALL_INERTIA };
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL.radius).setMassProperties(BALL.mass, ZERO, inertia, IDENTITY)
        .setRestitution(0).setFriction(SURFACES.floor.friction),
      this.ball,
    );
    for (let i = 0; i < 2; i++) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(PADDLE.hitHalfThickness, PADDLE.hitRadius).setRotation(AXIS_Z).setSensor(true), body,
      );
      this.paddles.push({ body, collider });
    }
    this.world.step();
  }

  private addStatic(kind: SurfaceKind, centre: Vec3, halfExtents: Vec3): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(centre.x, centre.y, centre.z));
    const surface = SURFACES[kind];
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setRestitution(0).setFriction(surface.friction), body,
    );
    this.statics.push({ collider, kind, surface });
  }

  getBall(): BallState {
    return { p: copy(this.ball.translation()), v: copy(this.ball.linvel()), w: copy(this.spin) };
  }

  setBall(state: BallState): void {
    this.held = false;
    this.ball.setTranslation(state.p, true);
    this.ball.setLinvel(state.v, true);
    this.setSpin(state.w);
  }

  private setSpin(w: Vec3): void {
    this.spin = copy(w);
    this.ball.setAngvel(w, true);
  }

  /** Pins the ball in place (in the server's hand) until the next setBall. */
  holdBall(p: Vec3): void {
    this.held = true;
    this.ball.setTranslation(p, true);
    this.ball.setLinvel(ZERO, true);
    this.setSpin(ZERO);
  }

  /** Advances one fixed timestep and reports the impacts that happened in it. */
  step(paddles: readonly PaddleBody[], resolveStroke: StrokeResolver): ContactEvent[] {
    const events: ContactEvent[] = [];
    const dt = PHYSICS.timestep;
    for (const p of paddles) this.paddles[p.player].body.setNextKinematicTranslation(p.position);
    this.ball.resetForces(true);
    if (this.held) {
      this.ball.addForce(v3(0, BALL.mass * PHYSICS.gravity, 0), true);
      this.ball.setLinvel(ZERO, true);
      this.world.step();
      return events;
    }
    const state = this.getBall();
    const aero = aeroAcceleration(state.v, state.w);
    this.ball.addForce(scale(aero, BALL.mass), true);
    const w = scale(state.w, spinDecay(dt));
    // Velocity Rapier will integrate this step (semi-implicit Euler), used for the swept test.
    const v = v3(state.v.x + aero.x * dt, state.v.y + (aero.y - PHYSICS.gravity) * dt, state.v.z + aero.z * dt);

    const event = this.sweepPaddles(state.p, v, w, paddles, resolveStroke) ?? this.sweepStatics(state.p, v, w);
    if (event) events.push(event);
    else this.setSpin(w);
    this.world.step();
    // Below Rapier's rotation cap its solver is trusted, so rolling friction on the floor shows up.
    if (length(this.spin) < this.solverSpinLimit) this.spin = copy(this.ball.angvel());
    return events;
  }

  private sweepStatics(p: Vec3, v: Vec3, w: Vec3): ContactEvent | null {
    let best: { toi: number; normal: Vec3; index: number } | null = null;
    for (let i = 0; i < this.statics.length; i++) {
      const hit = this.statics[i].collider.castShape(ZERO, this.ballShape, p, IDENTITY, v, PHYSICS.sweepMargin, PHYSICS.timestep, false);
      if (hit && (!best || hit.time_of_impact < best.toi)) best = { toi: hit.time_of_impact, normal: copy(hit.normal1), index: i };
    }
    if (!best) return null;
    const { kind, surface } = this.statics[best.index];
    const speed = -dot(v, best.normal);
    if (speed < PHYSICS.restSpeed) return null;
    const out = resolveContact(v, w, best.normal, ZERO, surface);
    const point = addScaled(p, v, best.toi);
    this.applyImpact(point, out.v, out.w);
    const onSurface = Math.abs(point.x) <= TABLE_HALF_WIDTH && Math.abs(point.z) <= TABLE_HALF_LENGTH;
    return {
      kind, point, normal: best.normal, speed,
      topFace: kind === 'table' && best.normal.y > PHYSICS.topFaceNormalY && onSurface,
    };
  }

  private sweepPaddles(p: Vec3, v: Vec3, w: Vec3, paddles: readonly PaddleBody[], resolveStroke: StrokeResolver): ContactEvent | null {
    for (const paddle of paddles) {
      if (!paddle.canHit) continue;
      const { body, collider } = this.paddles[paddle.player];
      body.setTranslation(paddle.position, true);
      const hit = collider.castShape(paddle.velocity, this.ballShape, p, IDENTITY, v, 0, PHYSICS.timestep, true);
      if (!hit) continue;
      const point = addScaled(p, v, hit.time_of_impact);
      const stroke = resolveStroke(paddle.player, { p: point, v, w });
      if (!stroke) continue;
      const out = resolveContact(v, w, stroke.normal, stroke.velocity, SURFACES.paddle);
      this.applyImpact(point, out.v, out.w);
      return { kind: 'paddle', player: paddle.player, point, normal: stroke.normal, speed: length(add(out.v, scale(v, -1))) };
    }
    return null;
  }

  private applyImpact(p: Vec3, v: Vec3, w: Vec3): void {
    this.ball.setTranslation(p, true);
    this.ball.setLinvel(v, true);
    this.setSpin(w);
    // The pre-impact aerodynamic force no longer matches the new velocity; drop it for this step.
    this.ball.resetForces(true);
  }

  dispose(): void {
    this.world.free();
  }
}
