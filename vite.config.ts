import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'
import { PUBLIC_PAGES } from './src/modules/marketing/seo-config.ts'

/** `vite preview` only falls back to the root index.html; serve the pre-rendered page for clean URLs like a static host would. */
const servePrerenderedRoutes: Plugin = {
  name: 'serve-prerendered-routes',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? '').split('?')[0] ?? ''
      if (path !== '/' && PUBLIC_PAGES.some((p) => p.path === path)) req.url = `${path}/index.html`
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), servePrerenderedRoutes],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/modules/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
