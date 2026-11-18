/** Web Audio synthesis parameters. Frequencies in Hz, times in seconds, gains linear. */
export interface ToneSpec {
  wave: OscillatorType;
  from: number;
  to: number;
  decay: number;
  gain: number;
}

export interface NoiseSpec {
  filter: BiquadFilterType;
  frequency: number;
  q: number;
  decay: number;
  gain: number;
}

export interface ImpactSpec {
  tone: ToneSpec;
  noise: NoiseSpec;
  /** Impact speed (m/s) or stroke power that maps to full volume. */
  fullScale: number;
  minGain: number;
  /** Pitch rises by this factor at full scale. */
  pitchRise: number;
}

export const AUDIO = {
  masterGain: 0.9,
  attack: 0.002,
  /** Value exponential ramps decay to (they cannot reach zero). */
  silence: 0.0001,
  noiseSeconds: 2,
  spatial: { refDistance: 1.6, rolloff: 0.7, maxDistance: 40 },
  paddle: {
    tone: { wave: 'sine', from: 560, to: 400, decay: 0.07, gain: 0.5 },
    noise: { filter: 'bandpass', frequency: 2300, q: 1.4, decay: 0.035, gain: 0.5 },
    fullScale: 1, minGain: 0.35, pitchRise: 0.45,
  },
  table: {
    tone: { wave: 'sine', from: 1280, to: 930, decay: 0.035, gain: 0.55 },
    noise: { filter: 'highpass', frequency: 3200, q: 0.7, decay: 0.012, gain: 0.25 },
    fullScale: 6, minGain: 0.25, pitchRise: 0.12,
  },
  floor: {
    tone: { wave: 'sine', from: 760, to: 540, decay: 0.05, gain: 0.4 },
    noise: { filter: 'bandpass', frequency: 1500, q: 1, decay: 0.02, gain: 0.2 },
    fullScale: 6, minGain: 0.15, pitchRise: 0.1,
  },
  net: {
    tone: { wave: 'triangle', from: 190, to: 120, decay: 0.09, gain: 0.25 },
    noise: { filter: 'lowpass', frequency: 700, q: 0.7, decay: 0.11, gain: 0.6 },
    fullScale: 8, minGain: 0.3, pitchRise: 0,
  },
  /** Impacts quieter than this are skipped (ball rolling on the floor). */
  minImpactSpeed: 0.35,
  crowd: {
    murmurGain: 0.085,
    murmurFrequency: 420,
    murmurQ: 0.5,
    /** Slow swell of the murmur: rate (Hz) and depth (0..1). */
    swellRate: 0.13,
    swellDepth: 0.35,
    /** Positions of the crowd sources (the long-side stands), metres. */
    sources: [[-7, 2.5, 0], [7, 2.5, 0]],
    applauseSeconds: 3.2,
    clapsPerSecond: 260,
    clapDecay: 0.012,
    applauseFrequency: 1900,
    applauseQ: 0.6,
    applauseGain: 0.5,
    /** Rally length that earns full applause. */
    fullRally: 9,
    minApplause: 0.25,
    gaspGain: 0.16,
    gaspFrom: 380,
    gaspTo: 760,
    gaspSeconds: 0.9,
    gaspQ: 2.5,
  },
  ui: { frequency: 880, decay: 0.06, gain: 0.12 },
  /** Short rising arpeggio for winning a game or match (semitone offsets from the root). */
  jingle: { root: 523.25, steps: [0, 4, 7, 12], stepSeconds: 0.11, decay: 0.32, gain: 0.16 },
  loseJingle: { root: 392, steps: [0, -3, -7], stepSeconds: 0.16, decay: 0.4, gain: 0.14 },
  semitone: 2 ** (1 / 12),
  seed: 7717,
} as const;
