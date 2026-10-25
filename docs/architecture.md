# Architecture

React 19 + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Vite + Tailwind CSS v4 + React Router. No backend.

## Modules (`src/modules/*`)

Domain modules are plain TypeScript with no React imports. UI modules depend on domain modules, never the reverse.

| Module | Kind | Responsibility |
|---|---|---|
| `brand-projects` | domain | Versioned project schema (Zod), validation + migration (`parseProject`), pure operations (create/duplicate/rename), project file format, `ProjectService` use-cases |
| `persistence` | domain | `ProjectRepository` port; IndexedDB adapter (via `idb`) with compare-and-put conflict detection; in-memory fallback |
| `typography-system` | domain | Modular type-scale maths (roles and font assignment come in later phases) |
| `font-catalog` | domain | Reserved for Phase 1 (existing-font catalogue); empty |
| `typeface-engine` | domain | Design DNA, construction kit, glyph recipes, generation, overrides/variants/restore-point operations. See `typeface-engine.md` |
| `glyph-editor` | domain + UI | Contour geometry, run layout with kerning, SVG specimen and glyph thumbnail components |
| `font-export` | domain + UI | `FontBuilder` port; Font Flux adapter; OS/2 patcher; download helper; export orchestration; font lab page |
| `font-validation` | domain | Per-glyph geometry checks, coverage classification (supported / invalid / missing), typeface-level checks, and binary checks (Font Flux `diagnose`) |
| `app-shell` | UI | App layout (responsive nav), dashboard, project workspace (`ProjectLayout` + section pages), `useProjectEditor` autosave hook, storage context |
| `marketing` | UI | Public website, `content.ts` (single source of capability status), `seo-config.ts` (page metadata shared by client and build) |
| `shared-ui` | UI | Button, Banner, non-modal Drawer |
| `design-tokens` | styling | `tokens.css` (Tailwind `@theme`): Manrope, `#C74504`, `#444444`, neutrals, radii, shadows |
| `testing` | support | Vitest setup (jsdom, fake-indexeddb), deterministic clock |

## Project model (schema version 2)

`Project { schemaVersion, id, name, createdAt, updatedAt, brand{personality[], notes}, typography{scale, roles[]}, fontSources[], customTypeface | null, exportHistory[] }`.
`CustomTypeface` holds the design DNA, engine version, per-glyph overrides, kerning, saved variants, restore points, licence and copyright. Glyph outlines are **derived** from the DNA on demand and never stored (except frozen outlines inside overrides), so stored data stays small and always matches the current design.

- **Validation:** every read from storage or file goes through `parseProject` (never throws, never mutates input).
- **Migration:** `MIGRATIONS[n]` upgrades n to n+1. v1 → v2 (Phase-0 proof typeface to design DNA) is implemented and tested, including an end-to-end browser test with a planted v1 row; the chain, "missing step" and "newer version" paths are tested with injected steps. A project saved by a newer app is refused, not truncated.
- **Font binaries are never stored.** Fonts are rebuilt from the glyph model on export. Nothing large goes in localStorage; IndexedDB holds project JSON only.

## Autosave (`useProjectEditor`)

Edits go to a draft and are saved after a 1.2 s pause using the same compare-and-put as manual saves. States: `saved`, `dirty`, `saving`, `error`, `conflict`, `invalid`. Edits typed during a save are saved by the next round, never dropped. On `conflict` autosave stops (offer: save mine as a copy, or load the latest). On `error` the draft stays on screen and the project file can be downloaded from memory. Navigating away while pending triggers a flush first; the user is only asked if that flush fails. The service validates every project before it reaches storage.

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

`CustomTypeface` to `analyzeTypeface` (generate + validate every glyph) to `validateTypeface` (blocks on errors, including glyphs that fail geometry checks) to `FontBuilder.build` (only supported glyphs, Font Flux, lazy-loaded) to `patchOs2` to `validateFontBinary` to download + `ExportRecord` (size, SHA-256) in the project's history.

## Testing conventions

- Unit/integration: colocated `*.test.ts(x)`, Vitest globals, jsdom, `fake-indexeddb`. Pure domain code is tested without React. Use `fakeClock()` for deterministic ids/time.
- Font tests run in the `node` environment and read the produced bytes with fontkit (independent of the exporter).
- E2E: `e2e/*.spec.ts`, Playwright against the production build. Use `exact: true` when locating the project-name textbox (the list page has "New project name").
