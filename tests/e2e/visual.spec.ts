import { expect, test } from '@playwright/test';
import { openGame, read, shot } from './helpers';

test('main menu renders over the live arena', async ({ page }) => {
  const errors = await openGame(page);
  await page.waitForTimeout(2500);
  await shot(page, '01-main-menu');
  console.log('renderer:', await read(page, (h) => h.view.renderer), 'fps:', await read(page, (h) => Math.round(h.view.fps)));
  expect(errors).toEqual([]);
});

test('quick match: serve, rally and HUD', async ({ page }) => {
  const errors = await openGame(page, '&autoplay=1');
  await page.getByRole('button', { name: 'Quick Match' }).click();
  await shot(page, '02-quick-setup');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => (window as any).lumenLoop.app.stage.session.sim.phase === 'rally', null, { timeout: 30_000 });
  await page.waitForTimeout(350);
  await shot(page, '03-rally');
  await page.waitForFunction(() => { const s = (window as any).lumenLoop.app.stage.session.sim.score; return s.points[0] + s.points[1] >= 2; }, null, { timeout: 90_000 });
  await shot(page, '04-after-points');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await shot(page, '05-paused');
  expect(await read(page, (h) => h.app.state)).toBe('paused');
  expect(errors).toEqual([]);
});
