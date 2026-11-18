import { AUDIO, type ImpactSpec } from '../config/audio';
import { createRng } from '../math/random';
import { clamp01, type Vec3 } from '../math/vec3';

/** Thin Web Audio wrapper: lazy context, master mute, shared noise buffer and spatial one-shots. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private readonly ready: ((ctx: AudioContext, out: AudioNode) => void)[] = [];

  /** Must be called from a user gesture; safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : AUDIO.masterGain;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
      for (const fn of this.ready) fn(this.ctx, this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Runs once the context exists (immediately if it already does). */
  whenReady(fn: (ctx: AudioContext, out: AudioNode) => void): void {
    if (this.ctx && this.master) fn(this.ctx, this.master);
    else this.ready.push(fn);
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : AUDIO.masterGain, this.ctx.currentTime, AUDIO.attack);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * AUDIO.noiseSeconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = createRng(AUDIO.seed);
    for (let i = 0; i < data.length; i++) data[i] = rng.range(-1, 1);
    return buffer;
  }

  /** Places the listener at the camera. */
  setListener(position: Vec3, forward: Vec3): void {
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      l.positionX.value = position.x; l.positionY.value = position.y; l.positionZ.value = position.z;
      l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(position.x, position.y, position.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  /** Creates a panner at a world position feeding the master bus. */
  panner(position: Vec3 | readonly [number, number, number]): AudioNode | null {
    if (!this.ctx || !this.master) return null;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = AUDIO.spatial.refDistance;
    p.rolloffFactor = AUDIO.spatial.rolloff;
    p.maxDistance = AUDIO.spatial.maxDistance;
    const [x, y, z] = Array.isArray(position) ? position : [(position as Vec3).x, (position as Vec3).y, (position as Vec3).z];
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    p.connect(this.master);
    return p;
  }

  /** Plays a tone-plus-noise impact at a world position, scaled by `amount` (speed or power). */
  impact(spec: ImpactSpec, position: Vec3, amount: number): void {
    const ctx = this.ctx;
    const out = this.panner(position);
    if (!ctx || !out || !this.noise) return;
    const level = clamp01(amount / spec.fullScale);
    const gain = spec.minGain + (1 - spec.minGain) * level;
    const pitch = 1 + spec.pitchRise * level;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = spec.tone.wave;
    osc.frequency.setValueAtTime(spec.tone.from * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(spec.tone.to * pitch, now + spec.tone.decay);
    this.envelope(og.gain, spec.tone.gain * gain, spec.tone.decay, now);
    osc.connect(og).connect(out);
    osc.start(now);
    osc.stop(now + spec.tone.decay + AUDIO.attack);

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const ng = ctx.createGain();
    src.buffer = this.noise;
    filter.type = spec.noise.filter;
    filter.frequency.value = spec.noise.frequency * pitch;
    filter.Q.value = spec.noise.q;
    this.envelope(ng.gain, spec.noise.gain * gain, spec.noise.decay, now);
    src.connect(filter).connect(ng).connect(out);
    src.start(now, (now * AUDIO.semitone) % 1);
    src.stop(now + spec.noise.decay + AUDIO.attack);
  }

  /** Non-spatial tone for UI feedback and jingles. */
  tone(frequency: number, decay: number, gain: number, delay = 0, wave: OscillatorType = 'triangle'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    this.envelope(g.gain, gain, decay, now);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + decay + AUDIO.attack);
  }

  envelope(param: AudioParam, peak: number, decay: number, at: number): void {
    param.setValueAtTime(AUDIO.silence, at);
    param.exponentialRampToValueAtTime(Math.max(peak, AUDIO.silence), at + AUDIO.attack);
    param.exponentialRampToValueAtTime(AUDIO.silence, at + AUDIO.attack + decay);
  }
}
