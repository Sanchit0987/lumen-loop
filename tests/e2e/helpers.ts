import { expect, type Page } from '@playwright/test';

export const SHOTS = 'tests/e2e/screenshots';

interface Hook {
  app: { state: string; screen: string; stage: { session: { sim: { phase: string; time: number; score: { points: number[]; games: number[]; winner: number | null } } } } };
  view: { renderer: string; fps: number };
}

/** Opens the game and waits until the arena has loaded and the main menu is up. */
export async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/?seed=42${query}`);
  await page.waitForFunction(() => (window as unknown as { lumenLoop?: Hook }).lumenLoop?.app.screen === 'main', null, { timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Quick Match' })).toBeVisible();
  return errors;
}

export const read = <T>(page: Page, fn: (hook: Hook) => T): Promise<T> =>
  page.evaluate((source) => (0, eval)(`(${source})`)((window as unknown as { lumenLoop: Hook }).lumenLoop), fn.toString()) as Promise<T>;

export const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: `${SHOTS}/${name}.png` });
