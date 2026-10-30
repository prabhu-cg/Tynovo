import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
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

/**
 * The pure-JavaScript Brotli encoder (the `brotli` package, an Emscripten build) loads its memory image through
 * `readBinary` only when it thinks it runs under Node or a bare shell; in a browser it falls through to a code path
 * that needs an Emscripten runtime object the build left out ("Browser is not defined"). The package already carries
 * the right loader (its own base64 `mem.js`), so the browser branch is pointed at it, and the module object is exported
 * for the browser as it is for Node. The edit fails the build if the package changes under it, and the WOFF2 export is tested in a real browser (e2e/editor.spec.ts).
 */
const BROTLI_BRANCH = ',v||x){var Ta=b.readBinary(W)'
const patchBrotliEncoder: Plugin = {
  name: 'patch-brotli-encoder',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]brotli[\\/]build[\\/]encode\.js$/.test(id)) return null
    if (!code.includes(BROTLI_BRANCH)) throw new Error('patch-brotli-encoder: the brotli package changed; review vite.config.ts before upgrading it.')
    // The build exports its module object only on its Node branch, so the browser gets an empty object without the second edit.
    return { code: `${code.replace(BROTLI_BRANCH, ',true){var Ta=b.readBinary(W)')}\n;"undefined"!==typeof module&&(module.exports=b);`, map: null }
  },
}

/** `vite preview` serves the same headers as production, read from vercel.json, so tests run under the real CSP. */
const productionHeaders = (): Record<string, string> => {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const all = config.headers.find((h) => h.source === '/(.*)')?.headers ?? []
  return Object.fromEntries(all.map((h) => [h.key, h.value]))
}

export default defineConfig({
  preview: { headers: productionHeaders() },
  plugins: [react(), tailwindcss(), servePrerenderedRoutes, patchBrotliEncoder],
  // The dev server pre-bundles dependencies with its own pipeline, so the same edit is applied there.
  optimizeDeps: { rolldownOptions: { plugins: [patchBrotliEncoder] } },
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
