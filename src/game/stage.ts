import { FLOW } from '../config/match';
import { PHYSICS } from '../config/physics';
import { identityQuat, integrateSpin, type Quat } from '../math/quat';
import { length } from '../math/vec3';
import type { Frame } from '../render/frame';
import type { SimEvent } from '../sim/events';
import type { Session } from './session';

/** Runs a session's simulation on the fixed timestep and turns its state into render frames. */
export class Stage {
  private accumulator = 0;
  private rotation: Quat = identityQuat();

  constructor(readonly session: Session) {}

  /** Advances by real seconds, returning every event from the steps that ran. */
  advance(dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    const sim = this.session.sim;
    this.accumulator += Math.min(dt, FLOW.maxFrameTime);
    let steps = 0;
    while (this.accumulator >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame) {
      events.push(...sim.step());
      this.rotation = integrateSpin(this.rotation, sim.ball.w, PHYSICS.timestep);
      this.accumulator -= PHYSICS.timestep;
      steps++;
    }
    // Drop any backlog rather than trying to catch up after a long stall.
    if (steps === PHYSICS.maxStepsPerFrame) this.accumulator = 0;
    return events;
  }

  frame(): Frame {
    const sim = this.session.sim;
    const [a, b] = sim.paddles;
    return {
      ball: sim.ball.p,
      ballRotation: this.rotation,
      ballSpeed: length(sim.ball.v),
      paddles: [
        { position: a.position, normal: a.normal, swing: a.swing },
        { position: b.position, normal: b.normal, swing: b.swing },
      ],
    };
  }
}
