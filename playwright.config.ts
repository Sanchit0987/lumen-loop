import { defineConfig } from '@playwright/test';

const PORT = 5183;

/** Screenshot checks run against the dev server with GPU-backed headless Chromium. */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
