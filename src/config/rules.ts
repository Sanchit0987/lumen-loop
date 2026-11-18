export const RULES = {
  pointsToWinGame: 11,
  winMargin: 2,
  servesPerTurn: 2,
  /** From this score for both players, service alternates every point. */
  deuceServeScore: 10,
  bestOfOptions: [3, 5] as const,
  defaultBestOf: 3,
} as const;

export type BestOf = (typeof RULES.bestOfOptions)[number];
