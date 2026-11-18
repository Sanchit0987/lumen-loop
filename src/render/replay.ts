import { REPLAY, REPLAY_CAMERAS } from '../config/match';
import { lerp } from '../math/vec3';
import type { CameraShot } from './camera';
import type { Frame, PaddleFrame } from './frame';

interface Stamped {
  time: number;
  frame: Frame;
}

const mixPaddle = (a: PaddleFrame, b: PaddleFrame, t: number): PaddleFrame => ({
  position: lerp(a.position, b.position, t),
  normal: lerp(a.normal, b.normal, t),
  swing: lerp(a.swing, b.swing, t),
});

/** Ring buffer of recent frames, sampled at a fixed rate of simulation time. */
export class ReplayBuffer {
  private readonly frames: Stamped[] = [];
  private readonly capacity = Math.ceil(REPLAY.sampleRate * REPLAY.bufferSeconds);

  record(time: number, frame: Frame): void {
    const last = this.frames[this.frames.length - 1];
    if (last && time - last.time < 1 / REPLAY.sampleRate) return;
    this.frames.push({ time, frame });
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  clear(): void {
    this.frames.length = 0;
  }

  get start(): number {
    return this.frames[0]?.time ?? 0;
  }

  get end(): number {
    return this.frames[this.frames.length - 1]?.time ?? 0;
  }

  /** Interpolated frame at a simulation time inside the buffer. */
  sample(time: number): Frame | null {
    const n = this.frames.length;
    if (n === 0) return null;
    let i = this.frames.findIndex((f) => f.time >= time);
    if (i <= 0) return this.frames[i === 0 ? 0 : n - 1].frame;
    const a = this.frames[i - 1], b = this.frames[i];
    const t = (time - a.time) / (b.time - a.time);
    return {
      ball: lerp(a.frame.ball, b.frame.ball, t),
      ballRotation: t < 1 / 2 ? a.frame.ballRotation : b.frame.ballRotation,
      ballSpeed: a.frame.ballSpeed + (b.frame.ballSpeed - a.frame.ballSpeed) * t,
      paddles: [mixPaddle(a.frame.paddles[0], b.frame.paddles[0], t), mixPaddle(a.frame.paddles[1], b.frame.paddles[1], t)],
    };
  }
}

/** Plays a section of the buffer back in slow motion, cutting between camera angles. */
export class ReplayPlayback {
  private time: number;
  private readonly from: number;

  constructor(private readonly buffer: ReplayBuffer, hitTime: number, private readonly until: number) {
    this.from = Math.max(buffer.start, hitTime - REPLAY.leadIn);
    this.time = this.from;
  }

  get done(): boolean {
    return this.time >= Math.min(this.until, this.buffer.end);
  }

  /** Advances by real seconds; returns the frame and camera shot to show. */
  advance(dt: number): { frame: Frame | null; shot: CameraShot } {
    this.time += dt * REPLAY.timeScale;
    const index = Math.floor((this.time - this.from) / REPLAY.cutInterval) % REPLAY_CAMERAS.length;
    return { frame: this.buffer.sample(this.time), shot: { kind: 'replay', index, camera: REPLAY_CAMERAS[index] } };
  }
}
