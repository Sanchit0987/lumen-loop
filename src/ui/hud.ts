import { TEXT } from '../config/text';
import type { PlayerIndex } from '../physics/types';
import { gamesToWin, type MatchScore } from '../rules/scoring';
import { button, el } from './dom';

export interface HudActions {
  pause(): void;
  mute(): void;
  strokeMode(mode: 'auto' | 'loop' | 'chop'): void;
}

const MILLIS = 1000;

/** In-match overlay: scoreboard, messages, stroke read-out, hints and touch controls. */
export class Hud {
  readonly root = el('div.hud');
  private readonly rows: { name: HTMLElement; games: HTMLElement; points: HTMLElement; row: HTMLElement }[] = [];
  private readonly banner = el('div.banner');
  private readonly stroke = el('div.stroke');
  private readonly hintBox = el('div.hint');
  private readonly fps = el('div.fps');
  private readonly replayTag = el('div.replay-tag', el('span.dot'), TEXT.replay, el('small', TEXT.skip));
  private readonly muteBtn: HTMLButtonElement;
  private bannerTimer = 0;
  private strokeTimer = 0;

  constructor(actions: HudActions) {
    const board = el('div.board');
    for (let i = 0; i < 2; i++) {
      const row = { name: el('span.name'), games: el('span.games'), points: el('span.points'), row: el('div.row') };
      row.row.append(el('span.serve-dot'), row.name, row.games, row.points);
      board.append(row.row);
      this.rows.push(row);
    }
    this.muteBtn = button('', actions.mute, 'icon');
    const pauseBtn = button('\u275a\u275a', actions.pause, 'icon');
    pauseBtn.setAttribute('aria-label', 'Pause');
    const hold = (label: string, mode: 'loop' | 'chop'): HTMLButtonElement => {
      const b = el('button.btn.touch', label);
      b.type = 'button';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); actions.strokeMode(mode); b.classList.add('on'); });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        b.addEventListener(t, () => { actions.strokeMode('auto'); b.classList.remove('on'); });
      }
      return b;
    };
    this.root.append(
      board, el('div.corner', this.muteBtn, pauseBtn), this.banner, this.stroke, this.hintBox, this.fps, this.replayTag,
      el('div.touch-row', hold('CHOP', 'chop'), hold('LOOP', 'loop')),
    );
    this.setMuted(false);
    this.setReplay(false);
    this.show(false);
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setNames(names: readonly [string, string]): void {
    // The far player is listed first, matching their position at the top of the screen.
    this.rows[0].name.textContent = names[1];
    this.rows[1].name.textContent = names[0];
  }

  setScore(score: MatchScore, server: PlayerIndex): void {
    const need = gamesToWin(score.bestOf);
    ([1, 0] as const).forEach((player, rowIndex) => {
      const row = this.rows[rowIndex];
      row.points.textContent = String(score.points[player]);
      row.games.replaceChildren(...Array.from({ length: need }, (_, i) => el(i < score.games[player] ? 'i.pip.on' : 'i.pip')));
      row.games.setAttribute('aria-label', `${score.games[player]} games`);
      row.row.classList.toggle('serving', server === player);
    });
  }

  message(text: string, seconds: number, tone: 'good' | 'bad' | 'info' = 'info'): void {
    this.banner.textContent = text;
    this.banner.className = `banner show ${tone}`;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), seconds * MILLIS);
  }

  showStroke(text: string, seconds: number): void {
    this.stroke.textContent = text;
    this.stroke.classList.add('show');
    window.clearTimeout(this.strokeTimer);
    this.strokeTimer = window.setTimeout(() => this.stroke.classList.remove('show'), seconds * MILLIS);
  }

  hint(text: string | null): void {
    this.hintBox.textContent = text ?? '';
    this.hintBox.classList.toggle('show', text !== null);
  }

  setFps(text: string | null): void {
    this.fps.textContent = text ?? '';
    this.fps.classList.toggle('show', text !== null);
  }

  setReplay(on: boolean): void {
    this.replayTag.classList.toggle('show', on);
    this.root.classList.toggle('replaying', on);
  }

  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '\u266a\u0338' : '\u266a';
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    this.muteBtn.classList.toggle('off', muted);
  }
}
