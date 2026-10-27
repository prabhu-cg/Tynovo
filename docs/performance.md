# Performance

Two kinds of measure: **size budgets** that fail the build, and **runtime checks** that fail the tests. Both are deliberately loose enough not to flake and tight enough to catch a real regression.

## Size budgets (`npm run budgets`, part of `npm run check`)

Gzip level 9, measured on the production build (2026-10-27). Each budget is the measured size plus about 15%. Raising one is a decision: say why in the commit.

| What | Measured | Budget |
|---|---|---|
| First-load JavaScript (entry + what it preloads) | 162.5 KB | 190 KB |
| Stylesheet | 13.0 KB | 16 KB |
| Preloaded font (Manrope, Latin) | 24.3 KB | 30 KB |
| Any other lazily loaded chunk | largest 25.1 KB (typeface editor) | 35 KB |
| Font Flux (font writer), lazy | 119.4 KB | 135 KB |

The check also fails if `font-flux-js`, `TypefacePage`, `ExportPage`, `TypographyPage` or `quality` ever lands in the first-load set.

**Known weight:** the entry chunk (134 KB gzip) holds React, the router and the shared UI, and the first load also pulls the 28 KB schema chunk (Zod) that the marketing home page does not strictly need. Splitting the schema out of the marketing path would save about 28 KB on the first visit; it has not been done.

## What is downloaded, and when (`e2e/performance.spec.ts`)

- The website and the dashboard never fetch the font writer, its wasm, or a catalog font. Only the interface font loads.
- The font writer stays out of every page that has no typeface (overview, font catalog, typography). It is fetched **once**, when the typeface editor needs a real font (its Preview tab draws the actual exported font next to the editor's drawing) or the export page builds one, and reused after that.
- Its 1 MB `brotli_wasm_bg.wasm` is present in `dist/` (Font Flux's WOFF2 support, which Tynovo does not use) but is **never requested**.
- Scrolling the entire font catalog downloads at most 40 font files of the 150+ it ships; fonts load only when previewed or used, a bounded number stay loaded, and failures are reported (`font-catalog/loader.ts`).

## Runtime (large projects)

"Large" is the most the file format allows for kerning (5,000 pairs) plus a hand-edited outline for every character: 90 glyphs × 3 contours × 300 points = 81,000 points, over 2 MB of JSON.

| Measure | Result | Ceiling in the test |
|---|---|---|
| Parse, validate and hash the project (node) | ~0.15 s | 3 s |
| Quality checks over the whole face (node) | ~0.2 s | 8 s |
| Validate, build and read back a TTF (node) | ~0.3 s | 15 s |
| Open the project in the browser | 0.54 s | 8 s |
| Open the Glyphs grid (90 glyphs) | 0.08 s | 5 s |
| Type 26 characters into the text preview | 0.07 s | 8 s |
| Longest main-thread task during all of that | 150 ms | 2 s |

These are from one development laptop in headless Chromium; a slower machine will be slower, which is why the ceilings are many times higher. Tests: `src/modules/font-export/large-project.test.ts` and `e2e/performance.spec.ts`.

How the app avoids expensive work: routes and heavy editors are lazy chunks; glyph outlines are derived on demand and not stored; autosave is debounced (1.2 s) and compares content before writing; exports are built only on request, from the saved project.

## Not measured

- Real devices, low-end phones, and Safari/Firefox (only headless Chromium on one machine).
- Lighthouse/Web Vitals on the deployed site. Run them against production after deploying and record the numbers in the release notes.
