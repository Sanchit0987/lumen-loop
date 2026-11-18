import { otherPlayer, type PlayerIndex } from '../physics/types';

export type PointReason = 'winner' | 'net' | 'out' | 'own-side' | 'serve-fault' | 'missed';

export type Verdict =
  | { type: 'point'; winner: PlayerIndex; reason: PointReason }
  | { type: 'let' };

/**
 * Rally state machine. Feed it paddle hits, playing-surface bounces, net touches and dead-ball
 * events in order; it answers with a verdict as soon as the rally is decided.
 */
export class Rally {
  /** Player who struck the ball last. */
  lastHitter: PlayerIndex;
  /** Player who is allowed (and required) to return the ball, once it has bounced on their side. */
  awaiting: PlayerIndex | null = null;
  /** Number of strokes so far, including the serve. */
  strokes = 0;
  over = false;
  private serving = true;
  private struck = false;
  private bouncedOwnSide = false;
  private netTouched = false;

  constructor(readonly server: PlayerIndex) {
    this.lastHitter = server;
  }

  /** Whether the serve stroke itself has been played. */
  get serveStruck(): boolean {
    return this.struck;
  }

  get isServe(): boolean {
    return this.serving;
  }

  canHit(player: PlayerIndex): boolean {
    if (this.over) return false;
    if (!this.struck) return player === this.server;
    return this.awaiting === player;
  }

  onPaddleHit(player: PlayerIndex): Verdict | null {
    if (this.over) return null;
    if (!this.struck) {
      if (player !== this.server) return null;
      this.struck = true;
    } else {
      // Volleying or hitting twice loses the point.
      if (this.awaiting !== player) return this.point(otherPlayer(player), 'missed');
      this.serving = false;
    }
    this.strokes++;
    this.lastHitter = player;
    this.awaiting = null;
    this.bouncedOwnSide = false;
    this.netTouched = false;
    return null;
  }

  onNet(): Verdict | null {
    if (!this.over && this.struck) this.netTouched = true;
    return null;
  }

  onTableBounce(side: PlayerIndex): Verdict | null {
    if (this.over || !this.struck) return null;
    const hitter = this.lastHitter;
    const receiver = otherPlayer(hitter);
    if (this.awaiting !== null) return this.point(hitter, 'winner');
    if (side === hitter) {
      if (this.serving && !this.bouncedOwnSide) {
        this.bouncedOwnSide = true;
        return null;
      }
      return this.point(receiver, this.serving ? 'serve-fault' : this.netTouched ? 'net' : 'own-side');
    }
    if (this.serving) {
      if (!this.bouncedOwnSide) return this.point(receiver, 'serve-fault');
      if (this.netTouched) return this.finish({ type: 'let' });
    }
    this.awaiting = receiver;
    return null;
  }

  /** Ball hit the floor, a table edge, left the arena or came to rest. */
  onDead(): Verdict | null {
    if (this.over || !this.struck) return null;
    const hitter = this.lastHitter;
    if (this.awaiting !== null) return this.point(hitter, 'winner');
    const reason: PointReason = this.serving ? 'serve-fault' : this.netTouched ? 'net' : 'out';
    return this.point(otherPlayer(hitter), reason);
  }

  private point(winner: PlayerIndex, reason: PointReason): Verdict {
    return this.finish({ type: 'point', winner, reason });
  }

  private finish(verdict: Verdict): Verdict {
    this.over = true;
    this.awaiting = null;
    return verdict;
  }
}
