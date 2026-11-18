import type { Difficulty } from '../config/ai';
import { DEFAULT_QUALITY, QUALITY, type Quality } from '../config/graphics';
import { RULES, type BestOf } from '../config/rules';

export interface Settings {
  quality: Quality;
  muted: boolean;
  bestOf: BestOf;
  difficulty: Difficulty;
  showFps: boolean;
  /** Index of the next tournament opponent to face. */
  tournamentRound: number;
}

const STORAGE_KEY = 'lumen-loop.settings.v1';

export const defaultSettings = (): Settings => ({
  quality: DEFAULT_QUALITY, muted: false, bestOf: RULES.defaultBestOf, difficulty: 'normal', showFps: false, tournamentRound: 0,
});

/** Merges stored values over the defaults, discarding anything invalid. */
export function parseSettings(raw: string | null): Settings {
  const base = defaultSettings();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<Settings>;
    if (data.quality && data.quality in QUALITY) base.quality = data.quality;
    if (typeof data.muted === 'boolean') base.muted = data.muted;
    if (typeof data.showFps === 'boolean') base.showFps = data.showFps;
    if (RULES.bestOfOptions.includes(data.bestOf as BestOf)) base.bestOf = data.bestOf as BestOf;
    if (data.difficulty === 'easy' || data.difficulty === 'normal' || data.difficulty === 'hard') base.difficulty = data.difficulty;
    if (Number.isInteger(data.tournamentRound) && (data.tournamentRound as number) >= 0) base.tournamentRound = data.tournamentRound as number;
  } catch {
    return base;
  }
  return base;
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode); settings then last for the session only.
  }
}
