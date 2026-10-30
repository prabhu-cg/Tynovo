# Font export: formats and validation (Phase 4)

What the app can export, how each file is checked, what was tested where, and what was **not** tested.
Nothing here is simulated: every result below comes from a file the app built, read by a tool that did not build it.

## Formats

| Format | Offered | Outlines | Media type | Why / why not |
|---|---|---|---|---|
| TrueType `.ttf` | yes | quadratic `glyf` (straight segments, and the quadratic curves the glyph editor makes, kept as they are) | `font/ttf` | Validated end to end (below). |
| OpenType `.otf` | yes | PostScript/CFF | `font/otf` | Validated the same way. The generator's contours are written **reversed**, because CFF uses the opposite winding to TrueType; the shapes are identical (tested by area and bounds). Quadratic curves become cubics (Font Flux, 2/3 rule) with control points on whole units: a curved glyph can differ from the design by a unit or so, so the read-back allows 2 units of bounds and 1% of ink area for glyphs with curves, and nothing for glyphs without. |
| WOFF / WOFF2 | **no** | – | – | Font Flux can write them, but the OS/2 metrics patch (`sfntPatch.ts`) cannot be applied inside a compressed container, WOFF2 needs a Brotli runtime, and neither was validated. They are not offered rather than offered untested. Wrapping a validated `.ttf` in WOFF is the obvious next step. |
| Variable, colour, collections | no | – | – | Out of scope. |

A file is never renamed into another format: `assertBytesAre` compares the first four bytes with the format before a build is returned, and the read-back repeats the check. The download name, the Blob's media type and the signature must agree (e2e test: both formats, name, `Blob.type`, magic bytes).

## What every export goes through (`exportTypeface`)

1. **Design validation** (`validateTypeface`): geometry of every glyph, design parameters, kerning pairs. Errors stop here: no file is built.
2. **Build** (`fontFluxBuilder`): only glyphs that passed validation; names, copyright and licence (the placeholder licence is never written); `Version 1.000`; side bearings; kerning; then `patchOs2` (Windows ascent/descent, x-height, vendor `NONE`, `head.fontRevision`, all checksums recomputed).
3. **Library validation** (`FontFlux.diagnose`) on the produced bytes.
4. **Read-back** (`verifyFontBytes`): the bytes are opened again and compared with the design. This is what makes "exported" mean "is the font that was designed":
   - signature matches the format; all required tables present; every table checksum and the whole-file checksum correct (own sfnt reader, `font-export/sfnt.ts`)
   - every supported character maps to a glyph with the expected name; no extra, missing or duplicate mappings; `.notdef` is glyph 0
   - advance widths, **left side bearings** (see "A bug the comparison found"), outline bounds and contour area equal the design
   - units per em, ascender, descender and Windows metrics
   - family, style, PostScript name, copyright, licence name and link, version string
   - every kerning pair between included glyphs
5. A failure at any stage returns `{ ok: false, stage }`. The interface offers no download, records nothing in the export history, and the project is untouched. A build that throws is reported the same way (e2e: failure injected, then a successful retry).

## Evidence

Run `npm run spike` to write `spikes/output/FormatTest-Regular.ttf` and `.otf` from the app's own exporter, then the checks below.

| Check | Tool | TTF | OTF |
|---|---|---|---|
| Opens; strict table and whole-file checksums | fontTools 4.60.2, `checkChecksums=2` (`scripts/verify-font.py`) | pass | pass |
| cmap, glyph names, `.notdef`, hmtx side bearings = outline xMin, outline winding, name/version/style flags, Windows metrics | `scripts/verify-font.py` | pass | pass (one exception, below) |
| Opens, maps all 95 ASCII characters, advance widths equal hmtx | **macOS CoreText** (`scripts/coretext-check.swift`, `verify-font.py --coretext`) | pass | pass |
| Renders text | CoreText to PNG (looked at) | pass | pass |
| Independent parse: names, metrics, widths, bounds, revision, kerning through GPOS | fontkit (Vitest, `formats.test.ts`) | pass | pass |
| Structural validation | Font Flux `diagnose` | 0 errors | 0 errors |
| Loaded and drawn by a browser | Chromium `FontFace` + canvas, in the app (`Preview`) | pass | not run in a browser (browsers draw the `.ttf` the preview builds) |
| Editor preview vs exported file | Chromium: width of the first line, and pixel agreement within 1 px at 160 px | widths equal; 100.0% pixel agreement (first line, all three families); e2e asserts ≥ 98% on a typeface with an edited glyph | – |
| Download name, media type, signature | Playwright | pass | pass |
| Damaged or wrong files are caught | Vitest: wrong signature, corrupted table, wrong advance, wrong design, wrong metadata, zeroed side bearings | pass | pass |

### A bug the comparison found

The first run of the preview-vs-file comparison reported widths equal but only 51% pixel agreement. The cause: the library writes every `hmtx` left side bearing as 0 unless told otherwise, while the outlines start at their own `xMin`. FreeType-based renderers (Chrome, Android, Linux) shift each glyph left by that difference; CoreText follows `head.flags` and would not. The same file would have rendered differently in different programs, and fontkit, the library's validator and the earlier fontTools run all passed it. The exporter now passes each glyph's `xMin`, `verifyFontBytes` fails any file where hmtx and outline disagree (`binary.side-bearing`), and a test zeroes every bearing to prove the check bites. After the fix the first line “Hamburgefonstiv” agrees on 100.0% of inked pixels (within 1 px) in all three families, with equal widths; plain intersection-over-union is 96.2% for the rounded family, the rest being anti-aliasing and glyph positions snapped to whole pixels, which is why the app measures agreement within one pixel rather than plain overlap.

### Known exception

Was: the library's own `.notdef` box has an hmtx side bearing of 0 while its outline starts at 50, in both formats (an earlier version of this note said TrueType was correct; it was not, and `verify-font.py` could not see it because fontTools shifts TrueType outlines to the hmtx bearing when drawing). Fixed in Phase 8: the exporter writes its own `.notdef` box with the right bearing, and `verify-font.py` now compares hmtx with the glyph header's xMin (TrueType) or the curve's xMin (CFF), `.notdef` included.

### Left side bearing of curved glyphs

A TrueType glyph header records the box around **every point, control points included**, and FreeType positions a glyph by `xMin - lsb`, so hmtx must carry that box's xMin (`font-export/sidebearing.ts`). A CFF font has no header; its bearing is where the ink starts, measured on the curve. The two agree for straight-edged glyphs and differ only when a control point sticks out past its curve (tested: a bump whose control point is 100 units outside its ink gets -100 in TTF and 0 in OTF).

## Production-build re-validation (Phase 7)

On 2026-10-27 the files were produced the way a person gets them: from the **production build** (`npm run build`, served by `vite preview` with the production headers), in Chromium, by clicking *Check and build* and *Download* for every construction family in both formats (Geometric, Rounded and Modular; `.ttf` and `.otf`: six files, 7-27 KB). Each downloaded file was then run through `scripts/verify-font.py --coretext` (fontTools with strict checksums, then CoreText on macOS):

| File | Result |
|---|---|
| Geometric `.ttf`, `.otf` | 13 of 13 checks pass |
| Rounded `.ttf`, `.otf` | 13 of 13 checks pass |
| Modular `.ttf`, `.otf` | 13 of 13 checks pass |

The checks are the ones listed above (strict table checksums, side bearings equal outline xMin, cmap/glyph consistency, `.notdef` first, outline direction for the format, names and `fontRevision`, `fsSelection`, and CoreText's advance widths and mappings equal to the file's own tables). The in-app read-back (`verifyFontBytes`) and the e2e fontkit checks run on every export as before. The re-run covers only these six default designs; designs with extreme parameters, hand-edited outlines and large kerning tables are covered by the unit tests and by the in-app read-back, not by this external pass.

## Not tested (cannot be, here)

- **Installing and rendering in Figma, Illustrator, Photoshop, InDesign, Glyphs, Sketch, Affinity, Word or any Windows application.** None are available in this environment. Windows (DirectWrite, GDI) was not tested at all; the Windows metrics and checksums are verified structurally, not by Windows.
- **Firefox and Safari rendering** (Safari shares CoreText, which was tested directly).
- **Font Bakery / OpenType Sanitiser**: Chromium's sanitiser accepted the `.ttf` (it loaded), but no separate Font Bakery run was made.
- **Hinting**: none is written (no TrueType instructions); unhinted fonts look fine on modern systems, and very small sizes on old Windows may look rough.
- **The OTF in a browser.** The in-app browser preview builds a TTF. The OTF is verified by fontTools, fontkit, the library validator and CoreText.
- **Large character sets and other scripts**: ASCII only.

Before relying on a font commercially, install it in the programs you use and look at it.

## Reproducing

```
npm run spike                                         # writes spikes/output/FormatTest-Regular.{ttf,otf}
python3 -m venv .venv && .venv/bin/pip install fonttools brotli
.venv/bin/python scripts/verify-font.py spikes/output/FormatTest-Regular.ttf --coretext   # macOS for --coretext
.venv/bin/python scripts/verify-font.py spikes/output/FormatTest-Regular.otf --coretext
npx playwright test e2e/editor.spec.ts                # browser rendering, downloads, comparison
```
