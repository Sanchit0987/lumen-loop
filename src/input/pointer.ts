import { INPUT } from '../config/input';
import { PADDLE } from '../config/paddle';
import { clamp, length, scale, v3, type Vec3 } from '../math/vec3';
import type { ControlView } from '../sim/controller';
import type { StrokeMode } from '../stroke/swing';
import type { InputSource } from './human';

const RIGHT_BUTTON = 2;
const MILLIS = 1000;

/** Maps a client-space cursor position to a point on the paddle plane (world x and depth). */
export type CursorProjector = (clientX: number, clientY: number) => { x: number; depth: number } | null;

/**
 * Mouse and touch input for the near-side player. The paddle sits under the mouse cursor and the speed
 * of the cursor on screen is the swing; touch drags move the paddle relatively so a finger never has to cover the paddle.
 */
export class PointerInput implements InputSource {
  private x = 0;
  private depth: number = PADDLE.restZ;
  private toss = false;
  private buttonMode: StrokeMode = 'auto';
  private touchMode: StrokeMode = 'auto';
  private lastTouch: { id: number; x: number; y: number } | null = null;
  /** Last pointer sample used to measure the swing, and the smoothed swing in screen metres/s. */
  private lastSample: { id: number; x: number; y: number; stamp: number } | null = null;
  private swingX = 0;
  private swingY = 0;
  private readonly off: (() => void)[] = [];

  /** Called on any pointer movement (used to hand control back from the keyboard). */
  onActivity: (() => void) | null = null;

  constructor(private readonly element: HTMLElement, private readonly project: CursorProjector) {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void): void => {
      element.addEventListener(type, fn as EventListener, { passive: false });
      this.off.push(() => element.removeEventListener(type, fn as EventListener));
    };
    on('pointermove', (e) => this.move(e));
    on('pointerdown', (e) => this.down(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e));
    on('contextmenu', (e) => e.preventDefault());
  }

  /** Sets the stroke style from on-screen touch buttons. */
  setTouchMode(mode: StrokeMode): void {
    this.touchMode = mode;
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    this.toss = true;
    if (e.pointerType === 'touch') {
      this.lastTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.lastSample = null;
      this.swingX = 0;
      this.swingY = 0;
    } else {
      this.buttonMode = e.button === RIGHT_BUTTON ? 'chop' : 'loop';
      this.move(e);
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      if (this.lastTouch?.id === e.pointerId) this.lastTouch = null;
    } else {
      this.buttonMode = 'auto';
    }
  }

  private move(e: PointerEvent): void {
    this.onActivity?.();
    const rect = this.element.getBoundingClientRect();
    this.measure(e, rect);
    if (e.pointerType === 'touch') {
      const last = this.lastTouch;
      if (!last || last.id !== e.pointerId) return;
      this.x = clamp(this.x + ((e.clientX - last.x) / rect.width) * INPUT.touchMetresPerWidth, -PADDLE.maxX, PADDLE.maxX);
      this.depth = clamp(this.depth + ((e.clientY - last.y) / rect.height) * INPUT.touchMetresPerHeight, PADDLE.minZ, PADDLE.maxZ);
      last.x = e.clientX;
      last.y = e.clientY;
      return;
    }
    const hit = this.project(e.clientX, e.clientY);
    if (!hit) return;
    this.x = clamp(hit.x, -PADDLE.maxX, PADDLE.maxX);
    this.depth = clamp(hit.depth, PADDLE.minZ, PADDLE.maxZ);
  }

  /** Updates the smoothed swing velocity from how far the pointer moved on screen. */
  private measure(e: PointerEvent, rect: DOMRect): void {
    const last = this.lastSample;
    this.lastSample = { id: e.pointerId, x: e.clientX, y: e.clientY, stamp: e.timeStamp };
    if (!last || last.id !== e.pointerId) return;
    const elapsed = Math.max((e.timeStamp - last.stamp) / MILLIS, 1 / MILLIS);
    const vx = (((e.clientX - last.x) / rect.width) * INPUT.swingMetresPerWidth) / elapsed;
    const vy = (((e.clientY - last.y) / rect.height) * INPUT.swingMetresPerHeight) / elapsed;
    const k = 1 - Math.exp(-elapsed / INPUT.swingSmoothing);
    this.swingX += (vx - this.swingX) * k;
    this.swingY += (vy - this.swingY) * k;
  }

  /** Hand speed in world axes for the near side: screen-right is +X, screen-up is towards the net. */
  swing(): Vec3 {
    const idle = this.lastSample ? (performance.now() - this.lastSample.stamp) / MILLIS : Infinity;
    const fade = idle <= INPUT.swingHold ? 1 : Math.exp(-(idle - INPUT.swingHold) / INPUT.swingDecay);
    const v = v3(this.swingX * fade, 0, this.swingY * fade);
    const speed = length(v);
    return speed > PADDLE.maxSpeed ? scale(v, PADDLE.maxSpeed / speed) : v;
  }

  target(_view: ControlView): { x: number; z: number } {
    return { x: this.x, z: this.depth };
  }

  consumeToss(): boolean {
    const t = this.toss;
    this.toss = false;
    return t;
  }

  mode(): StrokeMode {
    return this.touchMode !== 'auto' ? this.touchMode : this.buttonMode;
  }

  dispose(): void {
    for (const f of this.off) f();
  }
}
