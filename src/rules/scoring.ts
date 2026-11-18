import { RULES, type BestOf } from '../config/rules';
import { otherPlayer, type PlayerIndex } from '../physics/types';

export interface MatchScore {
  bestOf: BestOf;
  firstServer: PlayerIndex;
  points: [number, number];
  games: [number, number];
  /** Final points of each completed game. */
  history: [number, number][];
  winner: PlayerIndex | null;
}

export interface PointResult {
  gameWonBy: PlayerIndex | null;
  matchWonBy: PlayerIndex | null;
}

export const createMatch = (bestOf: BestOf = RULES.defaultBestOf, firstServer: PlayerIndex = 0): MatchScore => ({
  bestOf, firstServer, points: [0, 0], games: [0, 0], history: [], winner: null,
});

export const gamesToWin = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

/** Winner of a game with these points, or null while it is still in play. */
export function gameWinner(points: readonly [number, number]): PlayerIndex | null {
  const [a, b] = points;
  if (Math.max(a, b) < RULES.pointsToWinGame || Math.abs(a - b) < RULES.winMargin) return null;
  return a > b ? 0 : 1;
}

export const isDeuce = (points: readonly [number, number]): boolean =>
  points[0] >= RULES.deuceServeScore && points[1] >= RULES.deuceServeScore;

/** Who serves the next point: two serves each, one each from 10-10, first server alternating per game. */
export function currentServer(score: MatchScore): PlayerIndex {
  const [a, b] = score.points;
  const total = a + b;
  const deuceStart = RULES.deuceServeScore * 2;
  const turns = isDeuce(score.points)
    ? deuceStart / RULES.servesPerTurn + (total - deuceStart)
    : Math.floor(total / RULES.servesPerTurn);
  const gamesPlayed = score.games[0] + score.games[1];
  return ((score.firstServer + gamesPlayed + turns) % 2) as PlayerIndex;
}

const wouldWinGame = (score: MatchScore, player: PlayerIndex): boolean => {
  const next: [number, number] = [score.points[0], score.points[1]];
  next[player]++;
  return gameWinner(next) === player;
};

/** The player who wins the game by taking the next point, if any. */
export function gamePointFor(score: MatchScore): PlayerIndex | null {
  if (score.winner !== null) return null;
  if (wouldWinGame(score, 0)) return 0;
  return wouldWinGame(score, 1) ? 1 : null;
}

/** The player who wins the whole match by taking the next point, if any. */
export function matchPointFor(score: MatchScore): PlayerIndex | null {
  const player = gamePointFor(score);
  if (player === null) return null;
  return score.games[player] + 1 >= gamesToWin(score.bestOf) ? player : null;
}

/** Awards a point in place and reports whether it finished a game or the match. */
export function awardPoint(score: MatchScore, player: PlayerIndex): PointResult {
  const result: PointResult = { gameWonBy: null, matchWonBy: null };
  if (score.winner !== null) return result;
  score.points[player]++;
  const won = gameWinner(score.points);
  if (won === null) return result;
  result.gameWonBy = won;
  score.history.push([score.points[0], score.points[1]]);
  score.games[won]++;
  score.points = [0, 0];
  if (score.games[won] >= gamesToWin(score.bestOf)) {
    score.winner = won;
    result.matchWonBy = won;
  }
  return result;
}

export const loserOf = (winner: PlayerIndex): PlayerIndex => otherPlayer(winner);
