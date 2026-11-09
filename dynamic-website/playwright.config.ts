import { defineConfig } from '@playwright/test'

// E2E_BASE points the tests at another server (for example `npm run dev`); otherwise they run against `npm run preview`
const base = process.env.E2E_BASE
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: base ?? 'http://localhost:4173', viewport: { width: 1366, height: 768 } },
  webServer: base ? undefined : { command: 'npx vite preview --port 4173', port: 4173, reuseExistingServer: true },
})
