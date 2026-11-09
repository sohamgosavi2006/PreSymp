import { defineConfig, loadEnv } from 'vite'
import { createVoiceHandler } from './server/voice.mjs'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// the default build is a normal static dist/ (the OCR engine needs its files next to the page).
// `npm run build:single` makes one html file, without OCR
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), {
    name: 'clinic-voice',
    configureServer(server) { server.middlewares.use(createVoiceHandler({ apiKey: loadEnv(mode, '.', '').SARVAM_API_KEY })) },
    configurePreviewServer(server) { server.middlewares.use(createVoiceHandler({ apiKey: loadEnv(mode, '.', '').SARVAM_API_KEY })) },
  }, ...(mode === 'single' ? [viteSingleFile()] : [])],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  build: { chunkSizeWarningLimit: 4000 },
}))
