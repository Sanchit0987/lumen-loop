import { DIFFICULTY, TOURNAMENT, type Difficulty } from '../config/ai';
import type { Quality } from '../config/graphics';
import { RULES, type BestOf } from '../config/rules';
import { HOW_TO_PLAY, TAGLINE, TEXT, TITLE } from '../config/text';
import type { Settings } from '../game/settings';
import { button, choice, el } from './dom';

export interface MenuActions {
  quick(): void;
  tournament(): void;
  versus(): void;
  resume(): void;
  restart(): void;
  quit(): void;
  next(): void;
  resetTournament(): void;
  change(patch: Partial<Settings>): void;
  open(screen: ScreenName): void;
  back(): void;
}

export type ScreenName = 'loading' | 'main' | 'quick' | 'tournament' | 'help' | 'settings' | 'pause' | 'result' | 'none';

export interface ResultInfo {
  title: string;
  detail: string;
  games: string;
  won: boolean;
  nextLabel: string | null;
}

const title = (): HTMLElement => el('header.logo', el('h1', TITLE), el('p', TAGLINE));
const bestOfOptions = RULES.bestOfOptions.map((n) => ({ value: n, label: `Best of ${n}` }));
const difficulties = (Object.keys(DIFFICULTY) as Difficulty[]).map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }));
const qualities: { value: Quality; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
];

/** Builds each menu screen on demand from current settings. */
export class Menus {
  readonly root = el('div.menus');
  current: ScreenName = 'loading';

  constructor(private readonly actions: MenuActions, private readonly settings: () => Settings, private readonly info: () => string) {}

  show(screen: ScreenName, result?: ResultInfo): void {
    this.current = screen;
    this.root.replaceChildren();
    this.root.className = `menus ${screen}`;
    if (screen === 'none') return;
    const panel = this.build(screen, result);
    this.root.append(panel);
    panel.querySelector<HTMLButtonElement>('button.primary')?.focus({ preventScroll: true });
  }

  private build(screen: ScreenName, result?: ResultInfo): HTMLElement {
    const a = this.actions;
    const s = this.settings();
    const bestOf = (): HTMLElement => choice<BestOf>('Match length', bestOfOptions, s.bestOf, (v) => a.change({ bestOf: v }));
    switch (screen) {
      case 'loading':
        return el('section.panel.centre', title(), el('p.loading', 'Building the arena\u2026'));
      case 'main':
        return el('section.panel.main', title(), el('nav.stack',
          button('Quick Match', () => a.open('quick'), 'primary'),
          button('Tournament', () => a.open('tournament')),
          button('Local 2-Player', a.versus),
          button('How to Play', () => a.open('help'), 'ghost'),
          button('Settings', () => a.open('settings'), 'ghost'),
        ), el('p.foot', this.info()));
      case 'quick':
        return el('section.panel', el('h2', 'Quick Match'),
          choice<Difficulty>('Opponent', difficulties, s.difficulty, (v) => { a.change({ difficulty: v }); this.show('quick'); }),
          el('p.note', `${DIFFICULTY[s.difficulty].name} \u2014 ${DIFFICULTY[s.difficulty].tagline}`),
          bestOf(),
          el('div.row-btns', button('Back', a.back, 'ghost'), button('Play', a.quick, 'primary')));
      case 'tournament': {
        const round = Math.min(s.tournamentRound, TOURNAMENT.length);
        const ladder = el('ol.ladder', ...TOURNAMENT.map((p, i) => el(
          `li${i < round ? '.beaten' : i === round ? '.next' : ''}`,
          el('b', `${i + 1}. ${p.name}`), el('span', p.tagline), el('em', i < round ? 'Beaten' : i === round ? 'Next' : 'Locked'),
        )));
        const done = round >= TOURNAMENT.length;
        return el('section.panel', el('h2', 'Lumen Open'), done && el('p.note.gold', TEXT.champion), ladder, bestOf(),
          el('div.row-btns', button('Back', a.back, 'ghost'),
            round > 0 && button('Start over', a.resetTournament, 'ghost'),
            !done && button(`Play round ${round + 1}`, a.tournament, 'primary')));
      }
      case 'help':
        return el('section.panel.wide', el('h2', 'How to Play'),
          el('dl.help', ...HOW_TO_PLAY.flatMap(([k, v]) => [el('dt', k), el('dd', v)])),
          el('div.row-btns', button('Back', a.back, 'primary')));
      case 'settings':
        return el('section.panel', el('h2', 'Settings'),
          choice<Quality>('Graphics quality', qualities, s.quality, (v) => a.change({ quality: v })),
          choice('Sound', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Muted' }], s.muted ? 'off' : 'on', (v) => a.change({ muted: v === 'off' })),
          choice('FPS counter', [{ value: 'off', label: 'Hidden' }, { value: 'on', label: 'Shown' }], s.showFps ? 'on' : 'off', (v) => a.change({ showFps: v === 'on' })),
          bestOf(),
          el('p.note', this.info()),
          el('div.row-btns', button('Done', a.back, 'primary')));
      case 'pause':
        return el('section.panel', el('h2', TEXT.paused), el('nav.stack',
          button('Resume', a.resume, 'primary'),
          button('Restart Match', a.restart),
          button('How to Play', () => a.open('help'), 'ghost'),
          button('Settings', () => a.open('settings'), 'ghost'),
          button('Quit to Menu', a.quit, 'ghost')));
      case 'result': {
        const r = result!;
        return el(`section.panel.centre${r.won ? '.won' : '.lost'}`, el('h2.big', r.title), el('p.result-games', r.games), el('p.note', r.detail),
          el('nav.stack',
            r.nextLabel && button(r.nextLabel, a.next, 'primary'),
            button('Rematch', a.restart, r.nextLabel ? '' : 'primary'),
            button('Main Menu', a.quit, 'ghost')));
      }
      default:
        return el('section');
    }
  }
}
