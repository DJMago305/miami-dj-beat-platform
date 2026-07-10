import { defineConfig, devices } from '@playwright/test';

/** TICKET-V2-RUNTIME-SCAFFOLD-001 — E2E smoke (scaffold only) */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/client/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
