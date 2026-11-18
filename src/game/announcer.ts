import { Sfx } from '../audio/sfx';
import { FLOW } from '../config/match';
import { REASON_TEXT, strokeLabel, TEXT } from '../config/text';
import type { PlayerIndex } from '../physics/types';
import type { GameView } from '../render/view';
import { gamePointFor, isDeuce, matchPointFor } from '../rules/scoring';
import type { SimEvent } from '../sim/events';
import type { Hud } from '../ui/hud';
import type { Session } from './session';

/** Turns simulation events into sound, HUD messages and athlete reactions. */
export class Announcer {
  constructor(private readonly sfx: Sfx, private readonly hud: Hud, private readonly view: GameView) {}

  begin(session: Session): void {
    this.hud.setNames(session.names);
    this.hud.setScore(session.sim.score, session.sim.server);
    this.view.setTint(0, session.tints[0]);
    this.view.setTint(1, session.tints[1]);
    this.view.clearEmotes();
    this.serveReady(session, session.sim.server);
  }

  handle(event: SimEvent, session: Session): void {
    const { humans, names, sim } = session;
    const soloHuman: PlayerIndex | null = humans[0] && !humans[1] ? 0 : null;
    this.sfx.handle(event, soloHuman);
    switch (event.type) {
      case 'hit':
        this.hud.hint(null);
        if (humans[event.player]) {
          this.hud.showStroke(strokeLabel(event.power, event.topspin, event.sidespin, event.serve), FLOW.strokeLabelTime);
        }
        break;
      case 'toss':
        this.view.clearEmotes();
        break;
      case 'let':
        this.hud.message(TEXT.let, FLOW.bannerTime);
        break;
      case 'serveReady':
        this.hud.setScore(sim.score, event.server);
        this.serveReady(session, event.server);
        break;
      case 'point': {
        this.hud.setScore(sim.score, sim.server);
        const tone = soloHuman === null ? 'info' : event.winner === soloHuman ? 'good' : 'bad';
        const head = event.matchWonBy !== null ? 'Match' : event.gameWonBy !== null ? 'Game' : 'Point';
        this.hud.message(`${head} to ${names[event.winner]} \u00b7 ${REASON_TEXT[event.reason]}`, FLOW.bannerTime, tone);
        if (event.gameWonBy !== null) {
          this.view.emote(event.gameWonBy, 'win');
          this.view.emote(event.gameWonBy === 0 ? 1 : 0, 'lose');
        }
        break;
      }
      default:
        break;
    }
  }

  private serveReady(session: Session, server: PlayerIndex): void {
    const { humans, sim } = session;
    if (humans[server]) this.hud.hint(server === 0 ? TEXT.serveHint : TEXT.serveHintKeys);
    else this.hud.hint(null);
    if (sim.score.points[0] + sim.score.points[1] === 0) return;
    if (matchPointFor(sim.score) !== null) this.hud.message(TEXT.matchPoint, FLOW.bannerTime);
    else if (gamePointFor(sim.score) !== null) this.hud.message(TEXT.gamePoint, FLOW.bannerTime);
    else if (isDeuce(sim.score.points)) this.hud.message(TEXT.deuce, FLOW.bannerTime);
  }
}
