import { Sfx } from '../audio/sfx';
import { TOURNAMENT } from '../config/ai';
import { KEYS } from '../config/input';
import { FLOW, REPLAY } from '../config/match';
import { PADDLE } from '../config/paddle';
import { TEXT } from '../config/text';
import { HybridInput, KeyboardInput, Keys } from '../input/keyboard';
import { PointerInput } from '../input/pointer';
import type { PhysicsWorld } from '../physics/world';
import type { CameraShot } from '../render/camera';
import { ReplayBuffer, ReplayPlayback } from '../render/replay';
import type { GameView } from '../render/view';
import { Hud } from '../ui/hud';
import { Menus, type ResultInfo, type ScreenName } from '../ui/menus';
import { Announcer } from './announcer';
import { createSession, isFinalRound, type Mode, type SessionInputs } from './session';
import { saveSettings, type Settings } from './settings';
import { Stage } from './stage';

export type AppState = 'menu' | 'playing' | 'paused' | 'replay' | 'result';

export interface AppOptions {
  autoplay: boolean;
  seed: number;
}

/** Top-level state machine: menus, match flow, pause, replay and results. */
export class App {
  state: AppState = 'menu';
  stage!: Stage;
  private readonly sfx = new Sfx();
  private readonly hud: Hud;
  private readonly menus: Menus;
  private readonly announcer: Announcer;
  private readonly keys = new Keys();
  private readonly pointer: PointerInput;
  private readonly inputs: SessionInputs;
  private readonly buffer = new ReplayBuffer();
  private playback: ReplayPlayback | null = null;
  private pending: { hitTime: number; until: number; delay: number } | null = null;
  private lastHitTime = 0;
  private result: ResultInfo | null = null;
  private mode: Mode = { kind: 'attract' };
  private matches = 0;
  private fpsClock = 0;

  constructor(
    private readonly view: GameView, private readonly world: PhysicsWorld,
    private readonly settings: Settings, private readonly options: AppOptions, ui: HTMLElement,
  ) {
    const canvas = view.handle.canvas;
    this.pointer = new PointerInput(canvas, (x, y) => view.projectCursor(x, y, PADDLE.restHeight, PADDLE.minZ, PADDLE.maxZ));
    const near = new HybridInput(this.pointer, new KeyboardInput(this.keys, KEYS.p1));
    this.pointer.onActivity = () => near.usePointer();
    this.inputs = { near, far: new KeyboardInput(this.keys, KEYS.p2) };
    this.hud = new Hud({
      pause: () => this.pause(), mute: () => this.change({ muted: !this.settings.muted }),
      strokeMode: (m) => this.pointer.setTouchMode(m),
    });
    this.menus = new Menus({
      quick: () => this.start({ kind: 'quick', difficulty: this.settings.difficulty }),
      tournament: () => this.start({ kind: 'tournament', round: this.settings.tournamentRound }),
      versus: () => this.start({ kind: 'versus' }),
      resume: () => this.resume(), restart: () => this.start(this.mode), quit: () => this.toMenu(),
      next: () => this.start({ kind: 'tournament', round: this.settings.tournamentRound }),
      resetTournament: () => { this.change({ tournamentRound: 0 }); this.menus.show('tournament'); },
      change: (patch) => this.change(patch),
      open: (screen) => this.menus.show(screen), back: () => this.menus.show(this.state === 'paused' ? 'pause' : 'main'),
    }, () => this.settings, () => `Renderer: ${view.renderer === 'webgpu' ? 'WebGPU' : 'WebGL2'} \u00b7 Quality: ${this.settings.quality}`);
    this.announcer = new Announcer(this.sfx, this.hud, view);
    ui.append(this.hud.root, this.menus.root);
    ui.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) this.sfx.click(); });
    for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => this.sfx.engine.unlock());
    canvas.addEventListener('pointerdown', () => { if (this.state === 'replay') this.finishReplay(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    window.addEventListener('resize', () => view.resize());
    this.sfx.engine.setMuted(settings.muted);
    this.hud.setMuted(settings.muted);
    this.toMenu();
  }

  /** Starts a new match in the given mode. */
  start(mode: Mode): void {
    this.mode = mode;
    const seed = this.options.seed + this.matches++;
    this.stage = new Stage(createSession(this.world, mode, this.settings.bestOf, this.inputs, seed, this.options.autoplay));
    this.buffer.clear();
    this.playback = null;
    this.pending = null;
    this.hud.setReplay(false);
    const live = mode.kind !== 'attract';
    this.state = live ? 'playing' : 'menu';
    this.hud.show(live);
    if (live) {
      this.menus.show('none');
      this.announcer.begin(this.stage.session);
    } else {
      this.view.setTint(0, this.stage.session.tints[0]);
      this.view.setTint(1, this.stage.session.tints[1]);
    }
  }

  toMenu(): void {
    this.start({ kind: 'attract' });
    this.menus.show('main');
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.menus.show('pause');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.menus.show('none');
  }

  change(patch: Partial<Settings>): void {
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    if (patch.quality) this.view.setQuality(patch.quality);
    if (patch.muted !== undefined) {
      this.sfx.engine.setMuted(patch.muted);
      this.hud.setMuted(patch.muted);
    }
    if (patch.showFps === false) this.hud.setFps(null);
  }

  get screen(): ScreenName {
    return this.menus.current;
  }

  /** One rendered frame; `dt` is real seconds since the last one. */
  frame(dt: number): void {
    this.shortcuts();
    let shot: CameraShot = this.state === 'menu' ? { kind: 'orbit' } : { kind: 'play' };
    let frame = this.stage.frame();
    let timeScale = 1;
    if (this.state === 'playing' || this.state === 'menu') {
      this.simulate(dt);
      frame = this.stage.frame();
    } else if (this.state === 'replay' && this.playback) {
      const shown = this.playback.advance(dt);
      frame = shown.frame ?? frame;
      shot = shown.shot;
      timeScale = REPLAY.timeScale;
      if (this.playback.done) this.finishReplay();
    } else {
      timeScale = 0;
    }
    const sim = this.stage.session.sim;
    this.view.setMarker(this.state === 'playing' && this.stage.session.humans[0] ? sim.incomingBounce(0) : null);
    this.view.render(frame, shot, dt, timeScale);
    const cam = this.view.rig.camera;
    this.sfx.engine.setListener(cam.position, cam.getForwardRay().direction);
    this.fpsClock += dt;
    if (this.settings.showFps && this.fpsClock > FLOW.fpsInterval) {
      this.fpsClock = 0;
      this.hud.setFps(`${Math.round(this.view.fps)} fps \u00b7 ${this.view.renderer}`);
    }
  }

  private simulate(dt: number): void {
    const session = this.stage.session;
    const sim = session.sim;
    const live = this.state === 'playing';
    for (const event of this.stage.advance(dt)) {
      if (!live) continue;
      this.announcer.handle(event, session);
      if (event.type === 'hit') this.lastHitTime = sim.time;
      if (event.type === 'point' && event.matchWonBy !== null) {
        this.result = this.buildResult(event.matchWonBy);
        this.pending = { hitTime: this.lastHitTime, until: sim.time + REPLAY.leadOut, delay: REPLAY.startDelay };
      }
    }
    this.buffer.record(sim.time, this.stage.frame());
    if (live && this.pending && (this.pending.delay -= dt) <= 0) {
      this.playback = new ReplayPlayback(this.buffer, this.pending.hitTime, this.pending.until);
      this.pending = null;
      this.state = 'replay';
      this.view.clearEmotes();
      this.hud.setReplay(true);
    }
    if (!live && sim.phase === 'matchOver') this.start({ kind: 'attract' });
  }

  private finishReplay(): void {
    this.playback = null;
    this.state = 'result';
    this.hud.setReplay(false);
    this.hud.show(false);
    this.menus.show('result', this.result ?? undefined);
  }

  private buildResult(winner: 0 | 1): ResultInfo {
    const { names, humans, sim } = this.stage.session;
    const won = winner === 0 || humans[1];
    const games = sim.score.history.map(([a, b]) => `${a}\u2013${b}`).join('  \u00b7  ');
    let nextLabel: string | null = null;
    let title = humans[1] ? `${names[winner]} wins` : won ? 'Victory' : 'Defeat';
    let detail = `${names[0]} ${sim.score.games[0]} \u2013 ${sim.score.games[1]} ${names[1]}`;
    if (this.mode.kind === 'tournament' && winner === 0) {
      const round = this.mode.round;
      this.change({ tournamentRound: Math.min(round + 1, TOURNAMENT.length) });
      if (isFinalRound(round)) { title = 'Champion!'; detail = TEXT.champion; }
      else nextLabel = `Next: ${TOURNAMENT[round + 1].name}`;
    }
    return { title, detail, games, won, nextLabel };
  }

  private shortcuts(): void {
    if (this.keys.consumeAny(KEYS.pause)) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'replay') this.finishReplay();
    }
    if (this.keys.consumeAny(KEYS.mute)) this.change({ muted: !this.settings.muted });
    if (this.keys.consumeAny(KEYS.restart) && (this.state === 'playing' || this.state === 'paused')) this.start(this.mode);
  }
}
