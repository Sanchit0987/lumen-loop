import { AUDIO } from '../config/audio';
import type { PlayerIndex } from '../physics/types';
import type { SimEvent } from '../sim/events';
import { Crowd } from './crowd';
import { AudioEngine } from './engine';

/** Maps simulation events to spatial sound effects and crowd reactions. */
export class Sfx {
  readonly engine = new AudioEngine();
  private readonly crowd = new Crowd(this.engine);

  /** `human` is the player the crowd-side jingles are judged for, or null in spectator modes. */
  handle(event: SimEvent, human: PlayerIndex | null): void {
    switch (event.type) {
      case 'hit':
        this.engine.impact(AUDIO.paddle, event.point, event.power);
        break;
      case 'bounce':
      case 'edge':
        if (event.speed > AUDIO.minImpactSpeed) this.engine.impact(AUDIO.table, event.point, event.speed);
        break;
      case 'floor':
        if (event.speed > AUDIO.minImpactSpeed) this.engine.impact(AUDIO.floor, event.point, event.speed);
        break;
      case 'net':
        this.engine.impact(AUDIO.net, event.point, event.speed);
        this.crowd.gasp();
        break;
      case 'point':
        this.crowd.cheer(event.strokes / AUDIO.crowd.fullRally + (event.gameWonBy !== null ? 1 : 0));
        if (event.gameWonBy !== null) this.jingle(human === null || event.gameWonBy === human);
        break;
      default:
        break;
    }
  }

  click(): void {
    this.engine.unlock();
    this.engine.tone(AUDIO.ui.frequency, AUDIO.ui.decay, AUDIO.ui.gain);
  }

  private jingle(won: boolean): void {
    const j = won ? AUDIO.jingle : AUDIO.loseJingle;
    j.steps.forEach((step, i) => this.engine.tone(j.root * AUDIO.semitone ** step, j.decay, j.gain, i * j.stepSeconds));
  }
}
