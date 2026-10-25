# Typeface engine (Phase 3; editing added in Phase 4)

A deterministic, rule-based generator for **display typefaces**. It turns a small, validated parameter set (the *design DNA*) into glyph outlines, checks every glyph, and hands the ones that pass to the font exporter. It is not a general-purpose type editor: outlines come from parameters and per-glyph overrides, not from hand-placed points.

## Pipeline

```
DNA (validated) ──► recipe(character) ──► shapes ──► corner softening ──► whole units ──► contours ──► validation ──► font
                    uses Geo primitives   boolean     round / chamfer      integers        TrueType      per glyph
```

| Stage | Module | Notes |
|---|---|---|
| Parameters | `brand-projects/schema.ts` (`dnaSchema`), `typeface-engine/dna.ts` | Zod ranges + relationship checks (`dnaIssues`). |
| Construction kit | `typeface-engine/geo.ts` | Stems, bars, boxes, rings, diagonals, terminals, expressed in the glyph's resolved metrics and strokes. |
| Geometry | `typeface-engine/geometry/*` | Pure plane geometry. Booleans via `polygon-clipping` (MIT), made robust by quantising inputs. No fonts, DNA or React in here. |
| Recipes | `typeface-engine/glyphs/*` | One function per character: `upper`, `lower`, `digits`, `punct`. |
| Placement | `typeface-engine/generate.ts` | Side bearings from the ink bounds, advance width, tracking. |
| Validation | `font-validation/glyphs.ts`, `coverage.ts` | Geometry checks per glyph; coverage classification. |
| Edits | `typeface-engine/edit.ts`, `variants.ts` | Pure operations: overrides, restore points, variants. |

Geometry is independent of rendering and of the font file: `generate.ts` returns plain `Glyph` objects, rendered by `glyph-editor` (SVG) and written by `font-export`.

## Coordinate system and metrics

- Font units, **y up**, baseline at 0, **1000 units per em**. A glyph's ink starts at its left side bearing; the origin is the left edge of the advance.
- TrueType contour direction: **outer contours clockwise, counters counter-clockwise**.
- Contours are lists of on-curve points with whole-unit coordinates. Curves are flattened to polylines at generation time (see limitations).

`deriveMetrics(dna)` gives the metrics used by every glyph, so they are consistent across the family:

| Metric | Value |
|---|---|
| unitsPerEm | 1000 |
| capHeight | `capHeight` |
| xHeight | `round(capHeight × xHeightRatio)` |
| ascender (line) | `capHeight + ascenderRise + overshoot` |
| descender (line) | `−(descenderDepth + overshoot)` |
| lineGap | 0 |

Relationships are checked in `dnaIssues` (ascender ≥ cap height > x-height; descender below baseline) and per glyph (`glyph.outside-metrics`). Round glyphs overshoot the baseline and cap/x-height by `overshoot`. Side bearings come from the ink: `sidebearing × factor(edge class)`, where straight edges take 1.0, round 0.72, open (T, 7) 0.4 and diagonal (A, V) 0.22; `sidebearingBalance` shifts ink inside the advance; `tracking` is added to the advance but never pulls ink past it.

## Design DNA

| Group | Parameter | Meaning |
|---|---|---|
| Family | `family` | `geometric`, `rounded`, `modular`: presets (`defaultDna`) for the same parameters. |
| Proportions | `capHeight`, `xHeightRatio`, `ascenderRise`, `descenderDepth`, `widthScale` | Heights and a global width multiplier. |
| Strokes | `strokeThickness`, `contrast` | Vertical stroke weight; horizontal = thickness × contrast. Limited so counters stay open (`dna.stroke-clamped`). |
| Construction | `roundness`, `overshoot`, `crossbarPosition`, `aperture`, `grid` | 1 = circles, 0 = squares; vertical alignment of round glyphs; bar height; opening of C/G/e/s; snapping grid (0 = off). |
| Corners | `cornerStyle`, `cornerRadius`, `innerCornerRatio`, `terminal` | sharp / round / chamfer corners, inside-corner softening, and flat / angled / round stroke ends. A corner is never larger than 1.1× the stroke (`dna.corner-limited`). |
| Spacing | `sidebearing`, `sidebearingBalance`, `tracking`, `spaceWidth` | |

The families differ only in defaults: **geometric** (true ellipses, sharp cuts), **rounded geometric** (roundness 0.7, round corners and terminals), **modular** (roundness 0, 50-unit grid, chamfered corners). Any parameter can be changed in any family. `DNA_CONTROLS` drives the UI and is tested to match the schema ranges.

## Determinism

Identical DNA + overrides + engine version always produce byte-identical glyphs: no `Math.random`, no clock, no environment. Tested by generating twice (with and without the cache).

`ENGINE_VERSION` (`typeface-engine/version.ts`) must be bumped whenever a change alters outlines for the same DNA. Saved typefaces record the version they were designed against; a mismatch is reported as a note/warning, never hidden. Old engine versions are not kept: files are regenerated with the current engine.

## Per-glyph overrides

`overrides[char]` may hold: `params` (any of widthScale, strokeThickness, contrast, roundness, cornerRadius), `leftBearing` / `rightBearing` / `advanceWidth`, and `contours` (a *frozen* outline).

- Overrides **follow all other global changes** (a glyph with its own width still gets the new stroke weight).
- Global edits, family switches and resets **never remove an override**. Only `resetGlyph` / `resetAllOverrides` (explicit buttons) do.
- A frozen outline ignores shape changes by design; its spacing overrides still apply; `unfreezeGlyph` restores generation.

## Character coverage

Target set: the 95 printable ASCII characters (A–Z, a–z, 0–9, 32 punctuation/symbols, space). A character is **supported** only when a recipe exists *and* its outline passes validation. The app shows supported / invalid / missing per group and per character; exports contain exactly the supported glyphs.

**Not designed yet: `& @ { } ~`** (90 of 95 supported in every family). `marketing/content.ts` holds this list and a test fails if it drifts from what the engine reports. Characters outside ASCII (accents, symbols) are out of scope for this phase.

## Validation (every glyph)

Finite and whole-unit coordinates; ≥ 3 points; non-zero area; **no self-intersections or touching edges** (exact integer segment tests); correct winding by nesting depth; counters fully inside solid area; outline inside the vertical metrics; warnings for negative bearings and overhang. Failures make a glyph *invalid*: it is listed, left out of exports, and an export with invalid glyphs is blocked until fixed.

Robustness is established by tests, not by assumption: a sweep of every control at min/mid/max in all three families (162 combinations) and 120 seeded random combinations of **all** parameters (enum styles included) must produce zero invalid or failed glyphs. A larger offline run on the final code (1,500 random combinations, about 60 s) gave 1,497 fully valid typefaces; the other 3 each had a single invalid lowercase `s` (round terminals on a near-square bowl with a very heavy stroke, where the round cap collides with the spine). The engine detects this, reports it in Coverage and excludes the glyph from export, which is the intended behaviour at extreme settings, but it is a known weakness. These sweeps found and fixed real defects (counter radii larger than the counter, sub-unit spikes after rounding, corner cuts through thin joints, dots/asterisk past the metrics, floating-point failures inside the boolean library).

## Variations

`exploreVariants(base, seed, count, spread)` derives candidates from a seeded generator (mulberry32). Same design + seed + spread = same variants. Varied: stroke, contrast, width, roundness, corner size, x-height ratio, aperture, crossbar, sidebearing, tracking, occasionally terminal style; fixed: family, grid, vertical metrics. A saved variant stores its full DNA (the authoritative record) and its `origin` (seed, index, spread). The UI draws six candidates beside the current design, compares up to three side by side, saves favourites, and applies a variant after saving a restore point.

**Restore points** (`history`, max 30): saved automatically before the first change in a visit, before switching family, resetting or applying a variant, and on demand. Identical consecutive points are not duplicated. Restoring saves the current design first, so it can be undone.

## Schema migration (v1 → v2)

Phase 0/1 projects stored three loose numbers plus generated glyphs. `migrateV1toV2` maps them onto the DNA (`stem`→strokeThickness, `width`→widthScale, `radius`→roundness; clamped), keeps name, licence, copyright, kerning and overrides (advance widths, frozen outlines), drops the derived glyphs, and regenerates with the new engine, so outlines can differ in detail from the Phase-0 proof face. Saving writes v2.

## Performance and size

Measured on the dev machine: generating and validating all 95 characters from scratch takes about 35 ms; cached glyphs make previews of a few characters nearly free. A complete font is 8–22 kB (geometric 14 kB, rounded 22 kB, modular 8 kB), building in about 90 ms (first build includes loading the font library).

## Known limitations

- **Polyline outlines.** Curves are flattened (6–16 segments per quarter) rather than stored as quadratic Béziers: rounded shapes carry more points than hand-drawn curves (rounded family averages 92 points per glyph) and are not as smooth under extreme zoom. A curve-fitting pass is future work.
- **Round terminals** can leave a tiny spur on the lowercase `e` and `s` at small sizes, and at extreme settings (heavy stroke, near-square bowls) the `s` can collide with itself and is then reported as invalid.
- Several glyphs are simple constructions (single-storey a and g, a stacked-bowl S, plain 1 and 4, ASCII-only symbols). `#`, `*` and `+` look heavy in the modular family because chamfers eat small features.
- No kerning is generated. Pairs can be added from the Quality view's suggestions (and are written to the font); there is no pair-by-pair kerning editor.
- Per-glyph overrides cover shape parameters, spacing and (Phase 4) a hand-edited outline: a **point editor** for the polylines, not a Bézier editor (`glyph-editor.md`). A hand-edited glyph is frozen and ignores global shape changes until reset.
- No hinting, no OpenType features beyond kerning, no variable fonts. Output is TrueType (`.ttf`) or OpenType/CFF (`.otf`); see `font-export-validation.md`.
- Not tested in design applications other than via fontTools / fontkit / CoreText / Chromium (see `font-export-validation.md` for exactly what was and was not tested).

## Adding a glyph

1. Write a `spec((g) => shape, leftClass, rightClass)` in the right file under `glyphs/`, using only `Geo` primitives and `g.W()` for widths. Coordinates start anywhere; spacing is derived from the ink.
2. Remove the character from `UNSUPPORTED_SYMBOLS` if it was listed.
3. Run `npx tsx scripts/contact-sheet.ts` and look at all three families (`FOCUS='x' ONLY=modular` for a close-up).
4. `npm test`: the sweeps will tell you if the recipe breaks at any parameter extreme. If you change geometry for existing glyphs, bump `ENGINE_VERSION`.
