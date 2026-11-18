import { INPUT, type KeyMap } from '../config/input';
import { PADDLE } from '../config/paddle';
import { sampleAtDepth } from '../ai/intercept';
import { approach, clamp, type Vec3 } from '../math/vec3';
import type { ControlView } from '../sim/controller';
import { sideSign, type StrokeMode } from '../stroke/swing';
import type { InputSource } from './human';

/** Shared pressed-key registry. */
export class Keys {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly onDown = (e: KeyboardEvent): void => {
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  };
  private readonly onUp = (e: KeyboardEvent): void => void this.down.delete(e.code);

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True once for each fresh key press. */
  consume(code: string): boolean {
    return this.pressed.delete(code);
  }

  consumeAny(codes: readonly string[]): boolean {
    return codes.map((c) => this.consume(c)).some(Boolean);
  }
}

/** Keyboard paddle: strafe with left/right, swing by holding the forward key through the ball. */
export class KeyboardInput implements InputSource {
  private x = 0;
  private depth: number = PADDLE.restZ;

  constructor(private readonly keys: Keys, private readonly map: KeyMap) {}

  /** True while any movement key of this map is held (used to hand control over from the mouse). */
  get active(): boolean {
    const m = this.map;
    return [m.left, m.right, m.forward, m.back].some((k) => this.keys.isDown(k));
  }

  /** Aligns the virtual cursor with the paddle so control hand-over does not jump. */
  sync(view: ControlView): void {
    this.x = view.paddle.x;
    this.depth = view.paddle.z * sideSign(view.player);
  }

  target(view: ControlView, dt: number): { x: number; z: number } {
    const m = this.map;
    // Screen-right is +X for both players because the camera sits behind player 0.
    const strafe = (this.keys.isDown(m.right) ? 1 : 0) - (this.keys.isDown(m.left) ? 1 : 0);
    this.x = clamp(this.x + strafe * INPUT.keyStrafeSpeed * dt, -PADDLE.maxX, PADDLE.maxX);
    if (strafe === 0) this.assist(view, dt);
    if (this.keys.isDown(m.forward)) this.depth -= INPUT.keySwingSpeed * dt;
    else if (this.keys.isDown(m.back)) this.depth += INPUT.keyRetreatSpeed * dt;
    else this.depth += (PADDLE.restZ - this.depth) * Math.min(1, INPUT.keyRetreatSpeed * dt);
    this.depth = clamp(this.depth, PADDLE.minZ, PADDLE.maxZ);
    return { x: this.x, z: this.depth * sideSign(view.player) };
  }

  /** Eases the paddle onto the incoming ball's line so keyboard play is about timing, not pixels. */
  private assist(view: ControlView, dt: number): void {
    if (view.phase !== 'rally' || view.lastHitter === view.player || !view.prediction) return;
    const z = PADDLE.restZ * sideSign(view.player);
    const sample = sampleAtDepth(view.prediction, view.player, z, view.predictionAfterBounce && view.awaiting);
    if (!sample || Math.abs(sample.p.x - this.x) > INPUT.keyAssistReach) return;
    this.x += (sample.p.x - this.x) * approach(dt, INPUT.keyAssistTime);
  }

  consumeToss(): boolean {
    return this.keys.consume(this.map.toss);
  }

  mode(): StrokeMode {
    if (this.keys.isDown(this.map.loop)) return 'loop';
    return this.keys.isDown(this.map.chop) ? 'chop' : 'auto';
  }
}

/** Near-side player input: mouse/touch by default, keyboard whenever its movement keys are held. */
export class HybridInput implements InputSource {
  private usingKeys = false;

  constructor(private readonly pointer: InputSource, private readonly keyboard: KeyboardInput) {}

  target(view: ControlView, dt: number): { x: number; z: number } {
    if (this.keyboard.active && !this.usingKeys) {
      this.usingKeys = true;
      this.keyboard.sync(view);
    }
    const p = this.pointer.target(view, dt);
    if (!this.usingKeys) return { x: p.x, z: p.z * sideSign(view.player) };
    return this.keyboard.target(view, dt);
  }

  swing(view: ControlView): Vec3 | null {
    return this.usingKeys ? null : this.pointer.swing?.(view) ?? null;
  }

  /** Hands control back to the pointer (called on pointer movement). */
  usePointer(): void {
    this.usingKeys = false;
  }

  consumeToss(): boolean {
    const a = this.pointer.consumeToss();
    const b = this.keyboard.consumeToss();
    return a || b;
  }

  mode(): StrokeMode {
    const k = this.keyboard.mode();
    return k !== 'auto' ? k : this.pointer.mode();
  }
}
