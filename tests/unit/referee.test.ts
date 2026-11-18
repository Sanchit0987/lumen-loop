import { describe, expect, it } from 'vitest';
import { Rally } from '../../src/rules/referee';

/** A legal serve by player 0 that player 1 must now return. */
function served(): Rally {
  const r = new Rally(0);
  expect(r.onPaddleHit(0)).toBeNull();
  expect(r.onTableBounce(0)).toBeNull();
  expect(r.onTableBounce(1)).toBeNull();
  return r;
}

describe('serve', () => {
  it('only the server may strike first', () => {
    const r = new Rally(1);
    expect(r.canHit(0)).toBe(false);
    expect(r.canHit(1)).toBe(true);
  });

  it('a legal serve bounces on both halves and hands play to the receiver', () => {
    const r = served();
    expect(r.awaiting).toBe(1);
    expect(r.canHit(1)).toBe(true);
    expect(r.canHit(0)).toBe(false);
  });

  it('a serve that flies straight to the far half is a fault', () => {
    const r = new Rally(0);
    r.onPaddleHit(0);
    expect(r.onTableBounce(1)).toEqual({ type: 'point', winner: 1, reason: 'serve-fault' });
  });

  it('a serve bouncing twice on the server half or missing the table is a fault', () => {
    const twice = new Rally(0);
    twice.onPaddleHit(0); twice.onTableBounce(0);
    expect(twice.onTableBounce(0)).toEqual({ type: 'point', winner: 1, reason: 'serve-fault' });
    const long = new Rally(0);
    long.onPaddleHit(0); long.onTableBounce(0);
    expect(long.onDead()).toEqual({ type: 'point', winner: 1, reason: 'serve-fault' });
  });

  it('a serve that clips the net and lands correctly is a let', () => {
    const r = new Rally(0);
    r.onPaddleHit(0); r.onTableBounce(0); r.onNet();
    expect(r.onTableBounce(1)).toEqual({ type: 'let' });
    expect(r.over).toBe(true);
  });

  it('a serve into the net that falls back is a fault', () => {
    const r = new Rally(0);
    r.onPaddleHit(0); r.onTableBounce(0); r.onNet();
    expect(r.onTableBounce(0)).toEqual({ type: 'point', winner: 1, reason: 'serve-fault' });
  });

  it('nothing counts before the serve is struck', () => {
    const r = new Rally(0);
    expect(r.onTableBounce(0)).toBeNull();
    expect(r.onDead()).toBeNull();
    expect(r.over).toBe(false);
  });
});

describe('rally', () => {
  it('a good return continues the rally', () => {
    const r = served();
    expect(r.onPaddleHit(1)).toBeNull();
    expect(r.onTableBounce(0)).toBeNull();
    expect(r.awaiting).toBe(0);
    expect(r.strokes).toBe(2);
  });

  it('a second bounce wins the point for the striker', () => {
    const r = served();
    expect(r.onTableBounce(1)).toEqual({ type: 'point', winner: 0, reason: 'winner' });
  });

  it('an unreturned ball that reaches the floor wins the point for the striker', () => {
    const r = served();
    expect(r.onDead()).toEqual({ type: 'point', winner: 0, reason: 'winner' });
  });

  it('hitting long loses the point', () => {
    const r = served();
    r.onPaddleHit(1);
    expect(r.onDead()).toEqual({ type: 'point', winner: 0, reason: 'out' });
  });

  it('hitting onto your own half loses the point', () => {
    const r = served();
    r.onPaddleHit(1);
    expect(r.onTableBounce(1)).toEqual({ type: 'point', winner: 0, reason: 'own-side' });
  });

  it('hitting into the net loses the point; a net cord that goes over plays on', () => {
    const into = served();
    into.onPaddleHit(1); into.onNet();
    expect(into.onTableBounce(1)).toEqual({ type: 'point', winner: 0, reason: 'net' });
    const over = served();
    over.onPaddleHit(1); over.onNet();
    expect(over.onTableBounce(0)).toBeNull();
    expect(over.awaiting).toBe(0);
  });

  it('volleying before the bounce loses the point', () => {
    const r = served();
    r.onPaddleHit(1);
    expect(r.canHit(0)).toBe(false);
    expect(r.onPaddleHit(0)).toEqual({ type: 'point', winner: 1, reason: 'missed' });
  });

  it('ignores everything after the point is over', () => {
    const r = served();
    r.onDead();
    expect(r.onPaddleHit(1)).toBeNull();
    expect(r.onTableBounce(0)).toBeNull();
    expect(r.canHit(1)).toBe(false);
  });
});
