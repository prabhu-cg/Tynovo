# Font generation feasibility (Phase 0 spike)

**Result: pass.** The app generates a genuine TrueType (`.ttf`) file in the browser, and it was read back by four independent consumers. Evidence below; nothing here is simulated.

## Libraries evaluated

| Library | Licence | Can write a font from scratch? | Kerning (GPOS) | Verdict |
|---|---|---|---|---|
| **Font Flux JS** 2.9.1 (`font-flux-js`) | **GPL-3.0-only** | Yes. `FontFlux.create()`, `addGlyph()`, `addKerning()`, `export()`. TrueType `glyf` outlines. | Yes (GPOS pair kerning) | **Selected.** |
| opentype.js 2.0.0 | MIT | Yes, but CFF/OTF only; name table contains blank placeholder records; no `GPOS`. | **No.** The GPOS writer is an empty stub (`subtableMakers2 = new Array(10)`), verified in source and by output. | Rejected: cannot write kerning. |
| fonteditor-core 2.6.3 | MIT (LICENSE file; not in package metadata) | Capable of TTF writing | not evaluated | Not tested in depth; fallback candidate. |
| fontkit 2.0.4 | MIT | **No**, parser only | n/a | Used in tests as an *independent reader* to check our output. |

Decision on licensing was made by the project owner: **the app is distributed under GPL-3.0-only** because it bundles Font Flux JS. Fonts exported by the app are not GPL; their licence is the user's choice (see below). The exporter sits behind a `FontBuilder` interface (`src/modules/font-export/types.ts`) so it can be replaced if the app licence ever needs to change.

## What the proof of concept did (Phase 0)

*Superseded in Phase 3 by the typeface engine (`typeface-engine.md`); the findings below about the exporter, file verification and OS/2 patching still apply to engine output, which is covered by the same fontkit-based tests.*

`createProofTypeface()` builds "Proof Sans", 8 original glyphs (space A E H I L O T) from straight segments and quadratic rounded corners, with counters and 3 kerning pairs. `fontFluxBuilder.build()` turns it into a TTF.

## Verification performed

| Check | Tool | Result |
|---|---|---|
| Magic bytes, table directory | Vitest | `0x00010000` sfnt, tables: head maxp hhea cmap hmtx name OS/2 post loca glyf GPOS gasp |
| Names, cmap, metrics, bounds, kerning applied | **fontkit** (independent parser, in tests) | pass: family/PS name, 8 mapped code points, `AT` advance reduced by 60 |
| Structural validation | Font Flux `diagnose()` on the produced bytes | 0 errors, 0 warnings |
| **Strict sfnt checksums** | **fontTools 4.60** with `checkChecksums=2` (manual run) | pass |
| Table dump (names, OS/2, GPOS lookup, glyph flags) | fontTools (manual run) | pass |
| Opens in OS font stack | **macOS CoreText** `CTFontManagerCreateFontDescriptorsFromURL` (manual run) | parsed as "Proof Sans Regular", glyphs mapped, advances correct |
| Quick Look thumbnail | macOS `qlmanage` (manual run) | rendered |
| **Browser** | Chromium via Playwright: `FontFace.load()` + `document.fonts.check` + canvas width differs from fallback | pass (Chromium's font sanitiser accepted the file) |

Reproduce the file: `npm run spike` writes `spikes/output/ProofSans-Regular.ttf` (git-ignored).

**Not tested:** installing into a design application (Figma, Illustrator, Glyphs, Windows apps) and Firefox/Safari rendering. CoreText, which Safari and Apple design apps use, accepts the file, but that is not the same as testing those apps. Do this before relying on the export commercially.

## Issues found and how they are handled

1. **OS/2 win metrics.** Font Flux derives `usWinAscent/usWinDescent` from glyph bounds (700/0 for caps-only), which cramps line spacing in legacy Windows apps, and sets `achVendID` to `XXXX`. It does not let callers override them, and re-export recomputes them. We patch the exported bytes (`sfntPatch.ts`): win metrics = declared ascender/descender, `sxHeight` = declared x-height, vendor `NONE`, with table and whole-file checksums recomputed. Verified by fontTools strict mode and a checksum test. `USE_TYPO_METRICS` is already set by Font Flux.
2. **Name table version string** was written as `1.002`, not the conventional `Version 1.002`, and `head.fontRevision` stayed 1.0. Fixed in Phase 4: the exporter passes `Version x.yyy` and the patcher sets the revision.
3. **Kerning** is pair-based only. Class kerning, GSUB features (ligatures etc.) exist in the library but are not used yet.
4. **No TrueType hinting** (instructions). Unhinted fonts render fine on modern systems; very old Windows rasterisers may look rough at small sizes.
5. **`fsType` is 0** (installable embedding). Embedding permissions are a legal choice and are not yet exposed in the UI.
6. **TTF and OTF are exported (Phase 4).** WOFF and WOFF2 are supported by the library but not offered: not validated here. See `font-export-validation.md`.
7. **Glyph limits.** Contours are TrueType quadratic only (no cubic); no composite glyphs; no hinting; no variable fonts; no colour fonts. Outer contours must be clockwise and counters counter-clockwise, which `font-validation` checks, along with counters lying inside solid area.
8. **Bundle cost.** Font Flux is ~416 kB (124 kB gzip) and is lazy-loaded the first time a font is built, so it is not on the critical path of the app shell.

## Found later (Phase 4)

The library writes `hmtx` left side bearings as 0 unless each glyph is given its own, so outlines drawn from `xMin` were shifted by FreeType-based renderers while fontkit, `diagnose` and fontTools all passed the file. Found by comparing the editor preview with the browser's rendering of the exported file; fixed and now checked on every export. Details in `font-export-validation.md`.

## Licensing of generated fonts

The licence name/URL/copyright you set on a typeface are written to the name table (IDs 0, 13, 14). The default placeholder ("Not yet chosen by the project owner") is never written into a font. The app never infers or guarantees a licence: `license.verified` stays `false` until a person sets it, and the export drawer says so.
