# Brand Typography Studio

Free-first, browser-based studio with two connected modes: a **brand typography system** and a **custom typeface creator**. No account, backend, database, paid API or AI service. Projects live in your browser (IndexedDB) and can be exported as files.

> **Status: Phase 3 of 7 (typeface engine).** Working: public website; project dashboard and autosaving workspace; type-scale preview; and the **Custom Typeface Creator**: three rule-based families (geometric, rounded, modular) generating 90 of 95 target ASCII characters, per-glyph overrides, seeded variations with restore points, honest coverage reporting, and TrueType export. Not built yet: font catalog, role editing, brand previews, token/code export, outline-point editing. The website labels every capability *Available now*, *Early version* or *In development* from one data file (`src/modules/marketing/content.ts`).

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npx playwright install chromium` | One-time browser download for e2e |
| `npm run dev` | Dev server |
| `npm run build` | Type-check, production build, then `scripts/postbuild.mjs` (per-route HTML metadata, `sitemap.xml`, `robots.txt`) |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Strict TypeScript only |
| `npm run lint` | oxlint |
| `npm test` | Vitest + React Testing Library (unit/integration) |
| `npm run e2e` | Playwright (builds and serves the app itself) |
| `npx tsx scripts/make-og.ts` | Regenerate `public/og.png` from the generator's real outlines |
| `npx tsx scripts/contact-sheet.ts` | Render every generated glyph of each family to `spikes/output/*.png` for visual review (`FOCUS='ab&' ONLY=modular` for close-ups) |
| `npm run spike` | Writes `spikes/output/TestDisplay-Regular.ttf` for manual inspection |
| `npm run check` | typecheck, lint, unit tests, build |

Node 24 was used. No environment variables are required (`.env.example` says so).

## Configuration

`VITE_SITE_URL` (see `.env.example`): the public base URL, e.g. `https://studio.example.com`. Drives canonical links, Open Graph URLs, `sitemap.xml` and `robots.txt`. If unset the app works and the build warns and omits absolute URLs. Set it when building for production.

## Routes

| Route | Page |
|---|---|
| `/`, `/features`, `/how-it-works`, `/pricing`, `/examples`, `/licensing`, `/faq` | Public site (indexed, in the sitemap) |
| `/privacy`, `/terms` | Public **draft** legal pages (noindex, not in the sitemap, must be reviewed before launch) |
| `/app` | Redirects to `/app/projects` |
| `/app/projects` | Dashboard (loading, empty, populated, error states; New project drawer; import) |
| `/app/projects/:id` | Overview; `/typography` (Brand Typography System); `/typeface` (Custom Typeface Creator); `/export`; `/settings` |
| `/app/lab`, `/app/settings` | Font lab (feasibility page); app settings (storage facts) |

## Deployment notes

The build is static. The host must (1) serve `dist/` with clean URLs so `/features` returns `features/index.html` (Netlify, Vercel, Cloudflare Pages and GitHub Pages do; `vite preview` is patched to match), and (2) fall back to `index.html` for `/app/*` and unknown paths. App routes are client-rendered and `Disallow`ed in `robots.txt`.

## Architecture

See [docs/architecture.md](docs/architecture.md). The generator is documented in [docs/typeface-engine.md](docs/typeface-engine.md); font-file findings in [docs/font-generation-feasibility.md](docs/font-generation-feasibility.md).

## Licensing

- **This app: GPL-3.0-only** (see `LICENSE`), because it bundles [Font Flux JS](https://github.com/mattlag/Font-Flux-JS) (GPL-3.0-only).
- **Fonts you export** are *not* covered by the app's licence. You choose their licence; it is written into the font's metadata. The app does not verify or guarantee any licence.
- Interface font: Manrope (SIL OFL 1.1) via `@fontsource-variable/manrope`, self-hosted, no CDN.
- Other runtime dependencies: React (MIT), React Router (MIT), Zod (MIT), idb (ISC), brotli-wasm (Apache-2.0) and pako (MIT AND Zlib) via Font Flux.

## Known limitations

- The generator draws 90 of the 95 target characters (not `& @ { } ~`); outlines are polylines, not true curves. See `docs/typeface-engine.md` for the full list of limits.
- Exports TrueType (`.ttf`) only. Not yet tested in design applications (Figma, Illustrator, Glyphs) or Firefox/Safari; verified with fontTools, fontkit, macOS CoreText, Quick Look and Chromium.
- Roles in a project are displayed, not yet editable. Only the scale base/ratio, name, personality and notes are editable.
- Public pages are pre-rendered for metadata only (title, description, canonical, Open Graph). The page body is rendered in the browser, so crawlers that do not run JavaScript see an empty body.
- `privacy` and `terms` are drafts without an operator identity, address or jurisdiction; they need legal review.
- `/og.png` is a single image shared by all pages.
- Lint warnings remain (see `npm run lint`); 0 errors.
- Light theme only.
- The app is not responsive-tested below 375px or in browsers other than Chromium.
