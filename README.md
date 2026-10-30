# Tynovo

*Shape your brand’s voice.*

A free, browser-based studio with two connected modes:

- **Brand Typography System**: describe a brand, choose fonts from a bundled catalog of 24 open-licence families, set roles (display, heading, body, interface, caption), pairing and a fluid type scale, preview the system as a website, an editorial page, a product screen and a poster, and export a specification, CSS, design tokens and an HTML specimen.
- **Custom Typeface Creator**: generate an original typeface from three construction families (geometric, rounded, modular), refine it glyph by glyph, check its quality, and export real TrueType (`.ttf`) and OpenType/CFF (`.otf`) files. Use it inside the typography system.

There is no account, server, database, tracking or AI service. Projects live in your browser (IndexedDB) and move as files. Licensed **GPL-3.0-only** (see [Licence](#licence)).

> **Status.** Feature-complete through the planned phases 0 to 6, and Phase 7 (production hardening) is implemented and verified as far as the automated tooling goes: see [Verification](#verification). Production readiness is **not** claimed: the manual steps in [docs/release-checklist.md](docs/release-checklist.md) (design-tool testing, screen-reader pass, live-host checks, legal review) have not been done. Many capabilities are labelled **Early version** on the website; [docs/known-limitations.md](docs/known-limitations.md) lists exactly what is missing.

## Local setup

Needs Node.js **23.6 or newer** and npm.

```sh
npm ci
npm run dev          # http://localhost:5173 (pick another port if it is taken: npm run dev -- --port 5190 --strictPort)
```

No environment variable is needed to develop. For production-like builds set `VITE_SITE_URL` (see `.env.example`); it is the only variable Tynovo reads and it is public.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b`, `vite build`, then `postbuild` (pre-rendered page metadata, `404.html`, `robots.txt`, `sitemap.xml`, `third-party-notices.txt`) |
| `npm run preview` | Serve `dist/` with the production security headers |
| `npm run typecheck` / `lint` | TypeScript (strict) / oxlint |
| `npm test` | Unit and component tests (Vitest, jsdom, fake-indexeddb) |
| `npm run e2e` | Browser tests (Playwright, Chromium); builds and previews the site itself. First time: `npx playwright install chromium` |
| `npm run budgets` | Fail if the build exceeds the size budgets ([docs/performance.md](docs/performance.md)) |
| `npm run verify:dist` | Check the build output: pages, references, launch files, no secrets, no source maps |
| `npm run check` | Type check, lint, tests, build, budgets and output checks in one go |
| `npm run catalog` | Rebuild the font catalog from the font packages' metadata |
| `npm run spike` | Write a test font to `spikes/output/` for the external validators |

## Testing

- **Unit tests** (`src/**/*.test.ts[x]`): the engine, schema and migrations, persistence, export generators (including hostile-input tests), validation, entitlements, large-project timing.
- **Browser tests** (`e2e/*.spec.ts`): the workflows, plus Phase 7's `hardening` (headers, CSP, untrusted files, privacy claims), `accessibility` (axe at WCAG 2.2 AA over every route and state, keyboard, focus, motion, error announcements), `storage-failures` (quota, unavailable storage, two tabs, interruptions) and `performance` (lazy loading, large project) specs. They run under the same Content-Security-Policy as production.
- **External font validation** (not part of `npm test`): `scripts/verify-font.py` (fontTools, plus CoreText on macOS) and `scripts/coretext-check.swift`. How to run them and what they found: [docs/font-export-validation.md](docs/font-export-validation.md).

## Architecture

React 19, TypeScript (strict), Vite, Tailwind CSS v4, React Router. No backend. Domain modules are plain TypeScript with no React; UI modules depend on them, never the reverse.

```
src/
  app/                router
  modules/
    brand-projects/   project schema (Zod), migrations, recovery, ProjectService
    persistence/      IndexedDB repository (compare-and-put), in-memory fallback
    typeface-engine/  design DNA, glyph recipes, generation, variants
    glyph-editor/     outline geometry, undo, canvas, text layout
    font-export/      Font Flux adapter (TTF, OTF), read-back, download
    font-validation/  glyph, typeface and binary checks, quality report
    font-catalog/     24 bundled OFL fonts, bounded loader, recommendations
    brand-system/     roles, fit checks, preview text, workflow, revision
    typography-system/ type scale, fluid sizes
    export-centre/    CSS, tokens, specification, specimen, manifest, zip
    entitlements/     feature registry and plan configuration (no payments)
    app-shell/ marketing/ shared-ui/ design-tokens/ identity/   UI
scripts/              postbuild, budgets, output checks, notices, font validators
docs/                 design notes (below)
```

Details: [architecture](docs/architecture.md), [typeface engine](docs/typeface-engine.md), [glyph editor](docs/glyph-editor.md), [brand typography system](docs/brand-typography-system.md), [integrated workflow](docs/integrated-workflow.md), [free and paid architecture](docs/monetisation-architecture.md).

## Privacy, security and storage

- Projects are never transmitted. No cookies, analytics, trackers or third-party requests; this is tested, not only stated ([docs/security-and-privacy.md](docs/security-and-privacy.md)).
- Imported files and all typed text are untrusted; exports escape them ([security doc](docs/security-and-privacy.md)).
- Browser storage is local to one browser and can be cleared or evicted. What it can and cannot promise, and how failures and recovery behave: [docs/storage-and-recovery.md](docs/storage-and-recovery.md). **Export a project file to keep work you care about.**

## Deployment

Static build; Vercel is the supported target. Build, environment, headers, SPA fallback, verification and rollback: [docs/deployment.md](docs/deployment.md). Before a release: [docs/release-checklist.md](docs/release-checklist.md).

## Accessibility and performance

Target WCAG 2.2 AA; what was machine-checked, what was tested and what still needs a person: [docs/accessibility.md](docs/accessibility.md). Size budgets and runtime measurements: [docs/performance.md](docs/performance.md).

## Verification

Last full run (2026-10-27, development machine, Chromium):

- Type check passes; lint reports 0 errors and 3 style warnings (listed in the limitations).
- **495 unit tests** (42 files) and **199 browser tests** (Chromium) pass.
- Production build passes its size budgets (202 checks) and output verification (9 pages and 375 files; no secret, credential shape or source map).
- `npm audit --omit=dev`: 0 vulnerabilities.
- Six real fonts (Geometric, Rounded and Modular, each as `.ttf` and `.otf`), downloaded from the production build, pass all 13 external fontTools and CoreText checks each.

Not covered by that run: other browsers, design-tool testing, screen readers, the live host. See [docs/known-limitations.md](docs/known-limitations.md).

## Limitations

The short version: all 95 target ASCII characters, Latin only by decision (no accents, no other scripts); point editing with no Bézier curves; TTF and OTF only (no WOFF/WOFF2, no generated PDF); a fixed catalog of 24 fonts; storage is per-browser; tested in Chromium only; no screen-reader testing; legal pages not reviewed by a lawyer. The full list is [docs/known-limitations.md](docs/known-limitations.md).

## Licence

Tynovo is licensed under the **GNU General Public License v3.0 only** ([LICENSE](LICENSE)) because it uses [Font Flux JS](https://github.com/mattlag/Font-Flux-JS) (GPL-3.0-only) to write font files. The other dependencies are MIT, ISC, Apache-2.0, Unlicense, MIT+Zlib and, for the bundled fonts, the SIL Open Font License 1.1; their texts are in the built site's `third-party-notices.txt`. **Fonts you export are yours** and carry the licence you choose; Tynovo never puts a font made by someone else into an export.
