import { defineConfig, devices } from '@playwright/test'

/**
 * E2E гоняются на прод-сборке (build + preview): так проверяется
 * реальный Service Worker и офлайн-поведение PWA.
 * Целевые устройства — iPad (3 панели) и iPhone (1 колонка).
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173/food-tracker/',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'ipad', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
})
