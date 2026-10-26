# Architecture

React 19 + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Vite + Tailwind CSS v4 + React Router. No backend.

## Modules (`src/modules/*`)

Domain modules are plain TypeScript with no React imports. UI modules depend on domain modules, never the reverse.

| Module | Kind | Responsibility |
|---|---|---|
| `brand-projects` | domain | Versioned project schema (Zod), validation + migration (`parseProject`), pure operations (create/duplicate/rename), project file format, `ProjectService` use-cases |
| `persistence` | domain | `ProjectRepository` port; IndexedDB adapter (via `idb`) with compare-and-put conflict detection; in-memory fallback |
| `typography-system` | domain | Type-scale maths including fluid sizes (`sizeAt`/`cssSize`), the shared `typeStyles` description used by previews and exports, and value validation |
| `font-catalog` | domain | The bundled catalog generated from font-package metadata (24 OFL-1.1 fonts), studio tags, on-demand bounded loader, installed-font detection, search/filter, rule-based recommendations. See `brand-typography-system.md` |
| `brand-system` | domain | The link between the two modes: role-font resolution, custom-typeface fit, project operations, preview text and missing characters, readiness checks, workflow status, content revision, text escaping. See `integrated-workflow.md` |
| `export-centre` | domain | Pure generators for CSS, tokens, specification, specimen, manifest, zip, and `buildBundle` |
| `typeface-engine` | domain | Design DNA, construction kit, glyph recipes, generation, overrides/variants/restore-point operations. See `typeface-engine.md` |
| `glyph-editor` | domain + UI | Contour geometry, outline operations, undo history, editing session, working-copy bridge, viewport maths; text layout (tracking, word spacing, wrapping, kerning); SVG canvas, specimen and thumbnail components. See `glyph-editor.md` |
| `font-export` | domain + UI | `FontBuilder` port; Font Flux adapter (TTF, OTF); format table and signature guards; sfnt reader; OS/2/head patcher; download helper; export orchestration; background file checks; browser rendering comparison; font lab page |
| `font-validation` | domain | Per-glyph geometry checks, coverage classification, typeface-level checks, binary checks (Font Flux `diagnose`), read-back comparison of exported bytes with the design, and the quality report (findings with evidence and fixes; no score) |
| `entitlements` | domain | Feature registry, tier configuration (data, validated), capability resolution with a trust rule, presentation of locked features. No payment, account or server. See `monetisation-architecture.md` |
| `app-shell` | UI | App layout (responsive nav), dashboard, project workspace (`ProjectLayout` + section pages), `useProjectEditor` autosave hook, storage context |
| `marketing` | UI | Public website, `content.ts` (single source of capability status), `seo-config.ts` (page metadata shared by client and build) |
| `shared-ui` | UI | Button, Banner, non-modal Drawer |
| `design-tokens` | styling | `tokens.css` (Tailwind `@theme`): Manrope, `#C74504`, `#444444`, neutrals, radii, shadows |
| `testing` | support | Vitest setup (jsdom, fake-indexeddb), deterministic clock |

## Project model (schema version 4)

`Project { schemaVersion, id, name, createdAt, updatedAt, brand{personality[], notes}, typography{scale, roles[]{kind, font: custom-link | source-link | null, …}}, fontSources[], customTypeface | null, exportHistory[] }`. Roles link to the typeface by id; see `integrated-workflow.md`.
`CustomTypeface` holds the design DNA, engine version, per-glyph overrides, kerning, saved variants, restore points, licence and copyright. Glyph outlines are **derived** from the DNA on demand and never stored (except frozen outlines inside overrides), so stored data stays small and always matches the current design.

- **Validation:** every read from storage or file goes through `parseProject` (never throws, never mutates input).
- **Migration:** `MIGRATIONS[n]` upgrades n to n+1. v1 → v2 (Phase-0 proof typeface to design DNA), v2 → v3 (typed role font links) and v3 → v4 (brand direction, sizes, responsive, pairing, fallbacks, caption kind) are implemented and tested, including an end-to-end browser test with a planted v1 row; the chain, "missing step" and "newer version" paths are tested with injected steps. A project saved by a newer app is refused, not truncated.
- **Font binaries are never stored.** Fonts are rebuilt from the glyph model on export. Nothing large goes in localStorage; IndexedDB holds project JSON only.

## Autosave (`useProjectEditor`)

Edits go to a draft and are saved after a 1.2 s pause using the same compare-and-put as manual saves. States: `saved`, `dirty`, `saving`, `error`, `conflict`, `invalid`. Edits typed during a save are saved by the next round, never dropped. On `conflict` autosave stops (offer: save mine as a copy, or load the latest). On `error` the draft stays on screen and the project file can be downloaded from memory. Navigating away while pending triggers a flush first; the user is only asked if that flush fails. The service validates every project before it reaches storage.

## Unapplied work in the editor

The glyph editor holds a working copy outside the project until **Apply**. While it differs from the project the editor registers a `DraftGuard` with `ProjectLayout`, which owns the router's single blocker (React Router supports one per router). Leaving through navigation, back or reload then shows keep / apply / discard (and the browser's own prompt on tab close); the autosave-then-proceed flow for ordinary pending saves is unchanged.

## SEO

`seo-config.ts` holds title/description/indexability per public route. At runtime `<Seo>` applies them; at build time `scripts/postbuild.mjs` bakes them into `dist/<route>/index.html`, and writes `sitemap.xml` and `robots.txt` from `VITE_SITE_URL`. A unit test and e2e tests assert both paths agree.

## Persistence guarantees

- Save is compare-and-put in one IndexedDB transaction: it fails with `conflict` if the stored `updatedAt` differs from what the editor loaded (second tab). The UI offers "save mine as a copy" or "load latest"; nothing is overwritten silently.
- Create fails if the id exists; save fails if the project was deleted elsewhere.
- Unsaved edits: autosave plus a navigation blocker; tab close triggers the browser's `beforeunload` prompt while anything is unsaved.
- Import never replaces: an id clash is re-identified as "(imported)".
- Unreadable/corrupt/newer-schema records are listed separately, kept untouched, and can be downloaded raw or removed only by explicit action.
- If IndexedDB is unavailable, the app falls back to memory and shows a persistent warning. Quota errors are mapped to a clear message.

## Export pipeline

`CustomTypeface` to `analyzeTypeface` (generate + validate every glyph) to `validateTypeface` (blocks on errors) to `FontBuilder.build` (format `ttf` | `otf`; only supported glyphs; Font Flux, lazy-loaded; side bearings set per glyph) to `patchOs2` (Windows metrics, x-height, vendor, `fontRevision`, checksums) to `assertBytesAre` to `validateFontBinary` + `verifyFontBytes` (read the file back and compare it with the design) to download + `ExportRecord` (kind `font-ttf` | `font-otf`, size, SHA-256) in the project's history. Any failing stage returns `{ ok: false, stage }`: no file, no record, project untouched. See `font-export-validation.md`.

## Testing conventions

- Unit/integration: colocated `*.test.ts(x)`, Vitest globals, jsdom, `fake-indexeddb`. Pure domain code is tested without React. Use `fakeClock()` for deterministic ids/time.
- Font tests run in the `node` environment and read the produced bytes with fontkit (independent of the exporter).
- E2E: `e2e/*.spec.ts`, Playwright against the production build. Use `exact: true` when locating the project-name textbox (the list page has "New project name").
