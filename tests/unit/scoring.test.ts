import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../../src/physics/types';
import { awardPoint, createMatch, currentServer, gamePointFor, gamesToWin, gameWinner, isDeuce, matchPointFor, type MatchScore } from '../../src/rules/scoring';

const give = (s: MatchScore, player: PlayerIndex, n: number) => {
  let last = awardPoint(s, player);
  for (let i = 1; i < n; i++) last = awardPoint(s, player);
  return last;
};

describe('game scoring', () => {
  it('a game is won at 11 with a two point lead', () => {
    expect(gameWinner([11, 9])).toBe(0);
    expect(gameWinner([7, 11])).toBe(1);
    expect(gameWinner([10, 9])).toBeNull();
    expect(gameWinner([11, 10])).toBeNull();
    expect(gameWinner([12, 10])).toBe(0);
    expect(gameWinner([15, 17])).toBe(1);
    expect(gameWinner([20, 19])).toBeNull();
  });

  it('awarding the 11th point ends the game and resets the points', () => {
    const s = createMatch(3);
    give(s, 0, 10);
    const r = awardPoint(s, 0);
    expect(r.gameWonBy).toBe(0);
    expect(r.matchWonBy).toBeNull();
    expect(s.games).toEqual([1, 0]);
    expect(s.points).toEqual([0, 0]);
    expect(s.history).toEqual([[11, 0]]);
  });

  it('plays on past 10-10 until someone leads by two', () => {
    const s = createMatch(3);
    give(s, 0, 10); give(s, 1, 10);
    expect(isDeuce(s.points)).toBe(true);
    expect(awardPoint(s, 0).gameWonBy).toBeNull();
    expect(awardPoint(s, 1).gameWonBy).toBeNull();
    expect(awardPoint(s, 1).gameWonBy).toBeNull();
    expect(awardPoint(s, 1).gameWonBy).toBe(1);
    expect(s.history[0]).toEqual([11, 13]);
  });
});

describe('service order', () => {
  it('alternates every two points', () => {
    const s = createMatch(3, 0);
    const order: number[] = [];
    for (let i = 0; i < 8; i++) { order.push(currentServer(s)); awardPoint(s, (i % 2) as PlayerIndex); }
    expect(order).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });

  it('alternates every point from 10-10', () => {
    const s = createMatch(3, 0);
    give(s, 0, 10); give(s, 1, 10);
    const order: number[] = [];
    for (let i = 0; i < 4; i++) { order.push(currentServer(s)); awardPoint(s, (i % 2) as PlayerIndex); }
    expect(order).toEqual([0, 1, 0, 1]);
  });

  it('the other player serves first in the next game', () => {
    const s = createMatch(5, 1);
    expect(currentServer(s)).toBe(1);
    give(s, 0, 11);
    expect(currentServer(s)).toBe(0);
    give(s, 0, 11);
    expect(currentServer(s)).toBe(1);
  });
});

describe('match scoring', () => {
  it('needs 2 games in a best of 3 and 3 in a best of 5', () => {
    expect(gamesToWin(3)).toBe(2);
    expect(gamesToWin(5)).toBe(3);
  });

  it('best of 3 ends after two games to the same player', () => {
    const s = createMatch(3);
    give(s, 1, 11);
    expect(give(s, 1, 11).matchWonBy).toBe(1);
    expect(s.winner).toBe(1);
    expect(awardPoint(s, 0)).toEqual({ gameWonBy: null, matchWonBy: null });
    expect(s.points).toEqual([0, 0]);
  });

  it('best of 5 can go the distance', () => {
    const s = createMatch(5);
    give(s, 0, 11); give(s, 1, 11); give(s, 0, 11); give(s, 1, 11);
    expect(s.winner).toBeNull();
    expect(give(s, 0, 11).matchWonBy).toBe(0);
    expect(s.games).toEqual([3, 2]);
  });

  it('detects game point and match point', () => {
    const s = createMatch(3);
    give(s, 0, 10);
    expect(gamePointFor(s)).toBe(0);
    expect(matchPointFor(s)).toBeNull();
    awardPoint(s, 0);
    give(s, 1, 10); give(s, 0, 9);
    expect(gamePointFor(s)).toBe(1);
    expect(matchPointFor(s)).toBeNull();
    awardPoint(s, 0);
    expect(gamePointFor(s)).toBeNull();
    awardPoint(s, 0);
    expect(matchPointFor(s)).toBe(0);
  });
});
