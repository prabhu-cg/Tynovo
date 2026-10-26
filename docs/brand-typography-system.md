# Brand Typography System (Phase 2)

Create project → brand direction → select font families → assign roles → adjust the scale → preview → validate → export. Schema v4.

## Brand direction

`brand` holds name, description, personality, `useCases` (saas, editorial, consumer, campaign, corporate), `tones` (confident, friendly, technical, elegant, playful, serious), `readabilityPriority` and `displayPriority` (1–5) and saved `sampleCopy`. The brand name falls back to the project name. These inputs order the catalog and the suggestions; nothing else reads them except the exports.

## Font catalog (`font-catalog/`)

- **Source of facts.** `scripts/build-catalog.mjs` (`npm run catalog`) generates `catalog.data.ts` from each installed `@fontsource/<id>` package's own `metadata.json`/`package.json`: family, category, weights, styles, licence, copyright line, version, upstream source. A unit test re-reads the same files and fails if the data drifts or a bundled file is missing. Only OFL-1.1 fonts are catalogued (the script refuses anything else). 24 fonts today.
- **Studio tags.** `tags.ts` holds the studio's own judgement per font (tones, uses, "drawn for text", "suited to large sizes", superfamily, one factual note). They are labelled as judgement in the UI and never presented as metadata.
- **Search and filters.** Family-name search; category (sans serif, serif, monospace, display, handwriting); tone; use; "drawn for text"; "suited to large sizes"; order A–Z or by brand match. Weights, styles and licence are shown in the font's panel. Only Latin-subset upright weights 300–900 and the regular italic are bundled; the panel says so.
- **Loading (`loader.ts`).** Files are bundled assets resolved with `import.meta.glob(…?url)`: nothing is fetched until a font is requested, nothing comes from another origin (tested). Fonts used by roles are *pinned*; fonts previewed in the catalog are *loose* and only the 8 most recent stay registered (oldest faces are removed from `document.fonts`). A file that fails to load is reported as failed (with the reason and "Try again"), never as available. The loader is tested with an injected environment (limits, eviction, failure, retry).
- **Availability (`brand-system/availability.ts`).** A catalog font is "available" only once loaded; a font removed from the catalog is "unavailable". A font the user names is "installed" only if `font-catalog/installed.ts` detects it (it measures the same text with and without the family against three generic families, so it can miss a font whose metrics equal a generic's: the UI says "detected / not detected", never "available"). The checks list, role rows and font list all report this, and previews show the fallback.

## Roles, pairing, stacks

Roles: display, heading, body, interface, caption (optional); add/remove any, but one role of each of the first four kinds stays. A pairing (`typography.pairing`: primary = display and headings, secondary = body, interface and captions) is saved and **applied** to roles on request; the UI reports roles that differ. Removing a font or the typeface clears any pairing slot that used it. Fallback stacks: `FontSource.fallbackFamilies` + generic for existing fonts, `typography.customFallback` for the custom typeface; the same stack is used in previews and exports and is escaped.

## Recommendations (`font-catalog/recommend.ts`)

Fixed scoring of tags and metadata against tone, use cases and the two priorities. Every point has a visible reason and the score is exactly their sum (tested). They need at least a tone or a use case. Display, handwriting and monospace designs are never suggested for body text. Pairings combine a heading font and a text font, add points for a serif/sans contrast or a shared superfamily, subtract for two monospace fonts, and show each font's reasons and the pair's. No label says "accessible" or "optimal" (tested). The note on screen says they are not an AI model and not a legibility test.

## Type scale (`typography-system/`)

Base size and ratio; heading levels H1–H6 and body large/small as steps (`typography.sizes`); weight, line height and letter spacing per role; optional **fluid sizes** (`typography.responsive`): below the small width the small scale applies, above the large width the main scale, between them CSS `clamp()`. `sizeAt` (used by previews) and `cssSize` (used by the CSS export) are tested to agree at any width, and an e2e test applies the exported CSS in another page and compares size, weight, line height, spacing and family with the preview at 390 and 768 px. Hard limits are enforced by the schema and the inputs ("Between 1 and 3"); `validate.ts` explains legal-but-unlikely values (tiny body text, tight line height, ratio that is too large, headings out of order, inverted small scale…) in plain words, per field and per role. They are rules of thumb, not an accessibility test.

## Preview

Contexts: website (navigation, hero, buttons, editorial card), editorial (long-form text with headings, notes), product interface, poster. Light/dark surfaces; widths phone 390, tablet 768, fit. Sample copy is editable and **saved** (`brand.sampleCopy`), and the specimen uses it. All previews render from `typeStyles()` (`typography-system/tokens.ts`), the same description the CSS and tokens are generated from.

## Exports

As in `integrated-workflow.md`, plus: brand direction, heading/body sizes, responsive settings and fallback stacks in the specification; heading levels, body sizes, fluid `clamp()` values and brand under `$extensions` in tokens; `.type-h1…h6`, `.type-body-lg/sm` classes and `clamp()` sizes in CSS; package version, upstream version, source and copyright for each catalog font in the manifest; saved sample text and print styles in the specimen. **PDF:** the studio does not generate one (no reliable permitted client-side route without a new dependency); the specimen is built to print cleanly, so "Print → Save as PDF" in the browser produces one.

## Not done

Fonts beyond the 24 (no live font APIs by design), non-Latin subsets, italic weights other than 400, variable-font axes, uploaded font files, a printed-document preview, localised sample text.
