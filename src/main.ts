import './ui/styles.css';
import { Matrix, Vector3 } from '@babylonjs/core';
import { QUALITY, type Quality } from './config/graphics';
import { App } from './game/app';
import { loadSettings } from './game/settings';
import { PhysicsWorld } from './physics/world';
import type { RendererKind } from './render/engine';
import { GameView } from './render/view';
import { el } from './ui/dom';

const MILLIS = 1000;

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const loading = el('div.menus.loading', el('section.panel.centre', el('header.logo', el('h1', 'LUMEN LOOP')), el('p.loading', 'Building the arena\u2026')));
  ui.append(loading);

  // URL switches for testing: ?renderer=webgl2 &quality=low|medium|high &autoplay=1 &seed=123
  const params = new URLSearchParams(location.search);
  const settings = loadSettings();
  const quality = params.get('quality');
  if (quality && quality in QUALITY) settings.quality = quality as Quality;
  const renderer = params.get('renderer');
  const prefer: RendererKind | null = renderer === 'webgl2' || renderer === 'webgpu' ? renderer : null;
  const seed = Number(params.get('seed')) || Math.floor(performance.timeOrigin % MILLIS ** 2);

  const [view, world] = await Promise.all([GameView.create(canvas, settings.quality, prefer), PhysicsWorld.create()]);
  const app = new App(view, world, settings, { autoplay: params.has('autoplay'), seed }, ui);
  loading.remove();

  let last = performance.now();
  view.handle.engine.runRenderLoop(() => {
    const now = performance.now();
    app.frame((now - last) / MILLIS);
    last = now;
  });
  (window as unknown as { lumenLoop: unknown }).lumenLoop = { app, view, babylon: { Vector3, Matrix } };
}

boot().catch((error: unknown) => {
  console.error(error);
  const ui = document.getElementById('ui');
  if (ui) ui.replaceChildren(el('div.menus.loading', el('section.panel.centre', el('h2', 'Could not start'), el('p.note', String(error)))));
});
