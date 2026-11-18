import { expect, test } from '@playwright/test';
import { openGame, read, shot } from './helpers';

test('mouse control: a click serves, and following the ball returns it', async ({ page }) => {
  const errors = await openGame(page);
  await page.getByRole('button', { name: 'Quick Match' }).click();
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  const state = () => page.evaluate(() => {
    const { app, view } = (window as any).lumenLoop;
    const sim = app.stage.session.sim;
    const land = sim.incomingBounce(0);
    // Project the landing point to the screen so the test can put the cursor near it, as a player would.
    let screen: { x: number; y: number } | null = null;
    if (land) {
      const B = (window as any).lumenLoop.babylon;
      const p = B.Vector3.Project(new B.Vector3(land.x, 0.96, 1.67), B.Matrix.Identity(), view.scene.getTransformMatrix(), view.rig.camera.viewport.toGlobal(innerWidth, innerHeight));
      screen = { x: p.x, y: p.y };
    }
    return { phase: sim.phase, server: sim.server, strokes: sim.rally.strokes, lastHitter: sim.rally.lastHitter, screen };
  });
  let serves = 0, returns = 0, marked = false, lastStrokes = 0;
  await page.mouse.move(640, 600);
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline && (serves < 2 || returns < 3)) {
    const s = await state();
    if (s.phase === 'serve' && s.server === 0) {
      await page.waitForTimeout(600);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(() => (window as any).lumenLoop.app.stage.session.sim.phase !== 'serve', null, { timeout: 5000 });
      await page.waitForFunction(() => (window as any).lumenLoop.app.stage.session.sim.phase !== 'toss', null, { timeout: 5000 });
      if ((await state()).strokes >= 1) serves++;
      if (serves === 1) await shot(page, '06-human-serve');
      continue;
    }
    // Rallies against Easy can go on for a long time, so after three returns let the ball go by.
    if (returns >= 3) await page.mouse.move(40, 700);
    else if (s.screen) {
      await page.mouse.move(s.screen.x, s.screen.y, { steps: 3 });
      if (!marked) { marked = true; await shot(page, '06b-landing-marker'); }
    }
    if (s.phase === 'rally' && s.lastHitter === 0 && s.strokes > lastStrokes && s.strokes > 1) returns++;
    lastStrokes = s.phase === 'rally' ? s.strokes : 0;
    await page.waitForTimeout(50);
  }
  console.log('human serves', serves, 'returns', returns);
  expect(serves).toBeGreaterThanOrEqual(2);
  expect(returns).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('match point triggers a slow-motion replay, then the result screen', async ({ page }) => {
  const errors = await openGame(page, '&autoplay=1');
  await page.getByRole('button', { name: 'Quick Match' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.evaluate(() => { const s = (window as any).lumenLoop.app.stage.session.sim.score; s.games = [1, 1]; s.points = [10, 10]; });
  await page.waitForFunction(() => (window as any).lumenLoop.app.state === 'replay', null, { timeout: 150_000 });
  await page.waitForTimeout(900);
  await shot(page, '07-replay-a');
  await page.waitForTimeout(2400);
  await shot(page, '08-replay-b');
  await page.waitForFunction(() => (window as any).lumenLoop.app.state === 'result', null, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible();
  await shot(page, '09-result');
  expect(errors).toEqual([]);
});

test('tournament, help, settings and 2-player screens', async ({ page }) => {
  const errors = await openGame(page);
  await page.getByRole('button', { name: 'Tournament' }).click();
  await shot(page, '10-tournament');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'How to Play' }).click();
  await shot(page, '11-help');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'High' }).click();
  await page.waitForTimeout(1500);
  await shot(page, '12-settings-high');
  await page.getByRole('radio', { name: 'Low' }).click();
  await page.getByRole('radio', { name: 'Muted' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Local 2-Player' }).click();
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await shot(page, '13-versus-low');
  await page.keyboard.press('KeyR');
  expect(await read(page, (h) => h.app.state)).toBe('playing');
  expect(errors).toEqual([]);
});

test('WebGL2 fallback and portrait phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openGame(page, '&renderer=webgl2&autoplay=1');
  expect(await read(page, (h) => h.view.renderer)).toBe('webgl2');
  await shot(page, '14-phone-menu-webgl2');
  await page.getByRole('button', { name: 'Quick Match' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => (window as any).lumenLoop.app.stage.session.sim.phase === 'rally', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
  await shot(page, '15-phone-rally-webgl2');
  expect(errors).toEqual([]);
});
