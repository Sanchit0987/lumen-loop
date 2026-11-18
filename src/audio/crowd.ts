import { AUDIO } from '../config/audio';
import { createRng } from '../math/random';
import { clamp01 } from '../math/vec3';
import type { AudioEngine } from './engine';

const HALF = 0.5;

/** Synthesised crowd: a constant murmur from both stands, applause bursts and gasps. */
export class Crowd {
  private applause: AudioBuffer | null = null;
  private outputs: AudioNode[] = [];

  constructor(private readonly audio: AudioEngine) {
    audio.whenReady((ctx) => this.start(ctx));
  }

  private start(ctx: AudioContext): void {
    const C = AUDIO.crowd;
    this.applause = this.makeApplause(ctx);
    this.outputs = C.sources.map((s) => this.audio.panner(s)).filter((n): n is AudioNode => n !== null);
    const noise = this.audio.noiseBuffer;
    if (!noise) return;
    this.outputs.forEach((out, i) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = C.murmurFrequency;
      filter.Q.value = C.murmurQ;
      const gain = ctx.createGain();
      gain.gain.value = C.murmurGain;
      // Slow, out-of-phase swell so the murmur breathes instead of hissing.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = C.swellRate * (1 + i * HALF);
      depth.gain.value = C.murmurGain * C.swellDepth;
      lfo.connect(depth).connect(gain.gain);
      src.connect(filter).connect(gain).connect(out);
      src.start(0, i * HALF);
      lfo.start();
    });
  }

  /** Many short decaying claps at random times, with a fade in and a long fade out. */
  private makeApplause(ctx: AudioContext): AudioBuffer {
    const C = AUDIO.crowd;
    const length = Math.floor(ctx.sampleRate * C.applauseSeconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = createRng(AUDIO.seed + 1);
    const clapLength = Math.floor(ctx.sampleRate * C.clapDecay * 4);
    const claps = Math.floor(C.clapsPerSecond * C.applauseSeconds);
    for (let c = 0; c < claps; c++) {
      const at = rng.next();
      const start = Math.floor(at * (length - clapLength));
      const envelope = Math.min(1, at * 8) * (1 - at) ** 2;
      const level = rng.range(0.3, 1) * envelope;
      for (let i = 0; i < clapLength; i++) {
        data[start + i] += rng.range(-1, 1) * level * Math.exp(-i / (ctx.sampleRate * C.clapDecay));
      }
    }
    return buffer;
  }

  /** Applause scaled by how good the rally was (0..1). */
  cheer(amount: number): void {
    const ctx = this.audio.context;
    if (!ctx || !this.applause) return;
    const C = AUDIO.crowd;
    const level = C.minApplause + (1 - C.minApplause) * clamp01(amount);
    for (const out of this.outputs) {
      const src = ctx.createBufferSource();
      src.buffer = this.applause;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = C.applauseFrequency;
      filter.Q.value = C.applauseQ;
      const gain = ctx.createGain();
      gain.gain.value = C.applauseGain * level;
      src.connect(filter).connect(gain).connect(out);
      src.start();
    }
  }

  /** A collective "ooh" for net cords and near misses. */
  gasp(): void {
    const ctx = this.audio.context;
    const noise = this.audio.noiseBuffer;
    if (!ctx || !noise) return;
    const C = AUDIO.crowd;
    const now = ctx.currentTime;
    for (const out of this.outputs) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = C.gaspQ;
      filter.frequency.setValueAtTime(C.gaspFrom, now);
      filter.frequency.exponentialRampToValueAtTime(C.gaspTo, now + C.gaspSeconds * HALF);
      filter.frequency.exponentialRampToValueAtTime(C.gaspFrom, now + C.gaspSeconds);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(AUDIO.silence, now);
      gain.gain.exponentialRampToValueAtTime(C.gaspGain, now + C.gaspSeconds * HALF * HALF);
      gain.gain.exponentialRampToValueAtTime(AUDIO.silence, now + C.gaspSeconds);
      src.connect(filter).connect(gain).connect(out);
      src.start(now);
      src.stop(now + C.gaspSeconds);
    }
  }
}
