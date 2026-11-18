import { test } from '@playwright/test';
import { openGame, read } from './helpers';

/** Prints measured frame times per quality preset. Informational: headless GPUs vary widely. */
for (const quality of ['low', 'medium', 'high']) {
  test(`frame rate on ${quality}`, async ({ page }) => {
    await openGame(page, `&autoplay=1&quality=${quality}`);
    await page.getByRole('button', { name: 'Quick Match' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await page.waitForTimeout(3000);
    const stats = await page.evaluate(() => new Promise<{ fps: number; p95: number }>((resolve) => {
      const times: number[] = [];
      let last = performance.now();
      const tick = (now: number): void => {
        times.push(now - last);
        last = now;
        if (times.length < 240) requestAnimationFrame(tick);
        else {
          times.sort((a, b) => a - b);
          const mean = times.reduce((a, b) => a + b, 0) / times.length;
          resolve({ fps: 1000 / mean, p95: times[Math.floor(times.length * 0.95)] });
        }
      };
      requestAnimationFrame(tick);
    }));
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('webgl2');
      const ext = c?.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(c!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    });
    console.log(`[perf] ${quality}: ${stats.fps.toFixed(1)} fps, p95 frame ${stats.p95.toFixed(1)} ms, renderer ${await read(page, (h) => h.view.renderer)}, gpu ${info}`);
  });
}
