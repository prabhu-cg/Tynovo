# Integrated workflow (Phase 5)

One saved project carries both modes: **brand → typography system → custom typeface → apply font to roles → preview → validate → export.**

## One model, linked not copied

- `customTypeface` holds the design. Existing fonts live in `fontSources` (kinds `catalog` = bundled, `system` = named by the user). The project's own typeface is **never** copied into `fontSources`.
- A role links to a font with `role.font`: `{ kind: 'custom', typefaceId }`, `{ kind: 'source', sourceId }` or `null`. The two shapes differ on purpose, so a custom and an existing font cannot be confused. Removing a font or the typeface sets the roles that used it to `null` (after a confirmation that names them); a link that dangles anyway (a damaged file) resolves to origin `broken`, is flagged in the checks, and is never silently re-pointed at another font.
- `role.kind` (`display | heading | body | ui`) says what a role is for and decides what a custom typeface must satisfy.
- Duplicating a project deep-copies everything; ids are scoped to a project, so copies share role/typeface ids without interfering (tested).

## Is the typeface right for a role? (`brand-system/fit.ts`)

Measured from the design at the role's real size on the scale:

| Check | Blocks (typeface is not offered) | Warns |
|---|---|---|
| Required characters (per kind) are valid glyphs | any missing | |
| Thinnest stroke in px | < 0.6 | < 1 |
| x-height in px | < 4.5 | < 6 |
| Display role below 24px | | yes |
| Body/UI proportions: aperture, x-height ratio, stroke/x-height, width, side bearings, contrast | | thresholds in code |
| Role weight ≥ 600 (typeface has one weight, 400) | | synthetic bold, one-click "Use weight 400" |
| Typeface cannot be exported | | yes |

If a role already uses the typeface and a later edit makes it unsuitable, the assignment stays and is reported (blocking in "Before you export"). Thresholds are rules of thumb, stated in the code, not a score.

## Preview

`useProjectFont` (mounted once in `ProjectLayout`) builds a real TrueType file from the glyph model and registers it as a `FontFace` named `BTS Custom <id>`; it rebuilds (300 ms settle) only when dna, overrides, kerning or engine version change, and swaps the new face in before removing the old one. Previews (`brand-system/preview.ts`) render from text slots, and the missing-character warning is computed from the same slots, so it describes exactly what is on screen. Default sample copy is plain ASCII, so only the user's own words (a brand name with an accent) trigger warnings.

## Exports (`export-centre/`)

Everything is built by `buildBundle` from the **saved** project (`editor.saved`), never the draft; buttons wait while edits are unsaved. One pass gives one revision (`contentRevision`: 12 hex of SHA-256 over canonical JSON of name, brand, typography, font sources and typeface; export history and `updatedAt` excluded) written into every file, one font build (timestamps = project creation time, so the same design gives identical bytes), and a manifest that lists that font's real hash. History entries store `sourceRevision`; the centre marks earlier exports "out of date" when the project changed.

| File | Notes |
|---|---|
| `typography-spec.md` | brand, scale, roles, fonts, licences, custom-typeface limits, fit findings, checks |
| `tokens.json` | Design Tokens (DTCG) with origin/licence under `$extensions` |
| `typography.css` | custom properties, `.type-<role>` classes, `@font-face` for the custom font only |
| `specimen.html` | self-contained; custom font embedded; no scripts, no network |
| `SOURCES-AND-LICENSES.md` | per font: source, licence, confirmed?, file included? |
| `<project>.btstudio.json` | backup |
| `<Font>-Regular.ttf` | validated (same checks as the font export flow); OTF via the flow below it |
| `<project>-typography.zip` | all of the above, `fonts/` layout, stored (uncompressed) |

**No third-party font file is ever bundled.** Existing fonts are named in CSS and tokens; the CSS, the export centre and the manifest say the file must be supplied separately (bundled fonts say which npm package provides them). Files that refer to the custom font file (CSS, specimen, zip) are withheld, with the reason, when the typeface has errors that block export. All user text is escaped for CSS (strings and comments), HTML and Markdown (tests include hostile names).

## Project management

Create, rename, duplicate, save (autosave + "Save now"), reopen, export, delete. Delete shows what is lost and offers "Download a backup first"; it never requires one. Opening an older project upgrades it **in memory**; the stored copy is untouched until the first save, and the original is downloadable from a banner (`service.open`, `repo.getRaw`). `recoverProject` salvages a damaged record or file part by part (`brand-projects/recover.ts`), reports every loss, and always writes a **new** project: the damaged record stays until the person removes it.

## Schema v3

v2 → v3 (`migrations.ts`): `fontSourceId` becomes `font`, roles get `kind` (inferred from name, else size), font sources get `fallback`, the never-used `generated` source kind is dropped (roles that used it link to the typeface when there is one). Chained from v1; tested, including in the browser.

## Not done / not tested

- Roles cannot be added or removed; no wider font catalogue; no uploaded font files; no printed-document preview.
- The CSS/specimen/tokens were checked by tests and in Chromium only, not in design or build tools.
- Licences of existing fonts are what the user (or the bundled catalogue) says; nothing is verified.
