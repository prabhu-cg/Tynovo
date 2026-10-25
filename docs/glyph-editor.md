# Glyph editor (Phase 4)

A point editor for the engine's outlines, a text preview that shows the same glyphs two ways, and quality checks.

## Scope

The engine's geometry model is **polylines**: contours of straight segments between whole-unit points (`typeface-engine.md`). The editor edits exactly that: select, move, insert and delete points; no Bézier handles, no curve fitting, no off-curve points. A Bézier editor would require changing the model (and the generator's curve flattening), and was not needed to make glyphs editable.

Coordinates are whole font units (1000 per em), clamped to x −1000…4000 and y −1500…2500. A contour keeps at least three points. Editing is available for every glyph the engine can build (90 of 95 ASCII characters); the five without a design (`& @ { } ~`) say so and are not editable.

## Model

| Module | Role |
|---|---|
| `glyph-editor/outline.ts` | Pure operations: move, set, insert (midpoint or at a click), delete (refuses to leave a contour under three points; selecting a whole contour removes it), picking, marquee, stepping, remove stacked points, fix winding. |
| `glyph-editor/history.ts` | Undo and redo over immutable snapshots; a drag is one step; repeated nudges within 700 ms are one step; 200 steps kept. |
| `glyph-editor/session.ts` | One editing session on one glyph: working copy (outline + advance width), history, selection, and the last *applied* copy. "Unapplied" means working ≠ applied. |
| `glyph-editor/draft.ts` | Bridge to the project: `appliedDraft`, `generatedDraft`, `applyDraft`, bearing edits, one-click repairs for the checks. |
| `glyph-editor/viewport.ts`, `useViewport.ts` | Pan/zoom maths (pure, tested) and the measured canvas. |
| `glyph-editor/GlyphCanvas.tsx` | SVG surface: guides, outline, points, pointer gestures and the keyboard map. Owns no document state. |
| `app-shell/typeface/GlyphWorkspace.tsx` | The screen: header, alphabet strip, toolbar, canvas, inspector, "in context" strip. |

### Applying, saving and "unsaved"

There are two levels, and the interface keeps them apart:

1. **Working copy** (in the editor): every change goes here, with undo and redo. The header says *Unapplied changes* with a dot and the Apply and Discard buttons enable.
2. **Project** (autosaved to IndexedDB as before): **Apply changes** stores the outline and its advance width as the glyph's frozen outline (`setGlyphOutline`). If the working copy equals the generated shape, Apply stores "no hand edit" instead, so the glyph follows the design again.

Leaving with a working copy that differs from the project always asks: moving to another glyph or back to the grid (inline prompt), and leaving through the project navigation, the browser's back button or closing the tab (a single router blocker in `ProjectLayout`, extended with a `DraftGuard` the editor registers while it has unapplied work). Choices: keep editing, apply and continue, discard and continue. Discard is itself undoable until the glyph is left.

The address keeps the glyph (`?view=glyphs&glyph=H`), so a reload lands back in the editor.

### Reset to the generated shape

*Reset to generated shape* sets the working copy to what the generator would produce (shape parameters and bearing overrides kept, the frozen outline and its advance dropped). It is a normal undoable edit; *Apply* then returns the glyph to following the design. *Remove every override on this glyph* clears everything, as before. Global edits still never remove an override.

### Spacing

For a glyph that follows the design, left/right bearing and advance fields store **overrides** (as in Phase 3) and nothing is left unapplied. For a hand-edited or dirty glyph the same fields edit the working copy: the left bearing moves the outline and the advance (right bearing unchanged); the right bearing changes the advance.

## Keyboard and pointer

Every action is a button as well as a key. The canvas is one tab stop (`role="application"`, described by a hidden instruction line); points are chosen with `[` and `]`, so no tab order of 90 points.

| Input | Does |
|---|---|
| `[` `]`, `{` `}` | previous/next point, previous/next contour |
| Arrow keys (Shift: 10) | move selected points; pan the view when nothing is selected |
| `I` / Enter, Delete | insert after the selected point, delete the selection |
| Esc, Ctrl/Cmd+A | clear / select all |
| Ctrl/Cmd+Z, +Shift+Z (or +Y) | undo, redo |
| `+` `-` `0`, Ctrl/Cmd+wheel | zoom in, out, fit |
| Space+drag, Pan tool | pan |
| Click, Shift+click, drag a box | select, add, marquee |
| Drag (Shift: one axis) | move; optional snap to 5/10/25/50 |
| Double-click an edge | insert a point there |

The selected point's x and y are also number fields; the selection and the result of each action are announced in a polite live region.

## Text preview

`Preview` shows the same text twice, with the difference stated on the page:

- **Editor preview**: SVG drawn from the glyph data (outlines, advance widths, kerning pairs) at a real pixel size, wrapping at spaces.
- **Exported file**: a real TrueType file is built from the typeface and loaded by the browser, which draws the text.

Controls: editable text (new lines kept), alphabet / numerals / spacing-pair / word specimens, size, letter spacing, word spacing, line height, baselines, which panel to show. Letter and word spacing affect only the preview. *Compare preview with exported file* draws the first line both ways at 160 px with default spacing and reports widths and pixel agreement (within 1 px); see `font-export-validation.md` for what it caught.

## Quality checks

`font-validation/quality.ts` returns findings, never a score. Each has severity (**blocking**: no export, **warning**, **recommendation**), what was measured, the numbers, why it matters, the glyphs involved (links to the editor) and, where one is safe, a fix that is applied to the typeface (reverse wrong contours, remove stacked points or stray specks, fit an advance width, return a glyph to automatic spacing, add suggested kerning, set the style name…). The check list is data (`CHECKS`), shown in the interface with what each measures and **what it cannot tell you**.

| Group | Examples of what is measured |
|---|---|
| Coverage | target characters without a glyph; glyphs that failed to build |
| Outlines | every geometry error of Phase 3, negative bearings, ink past the advance, stray specks, stacked points |
| Mapping | duplicate code points, duplicate or invalid glyph names, invalid scalar values (unit-tested with synthetic input; the generator cannot produce them) |
| Metrics | bottoms off the baseline, tops off cap height / x-height / ascender (overshoot allowed), declared x-height and cap height against the letters |
| Widths | advance outliers against the median of uppercase/lowercase/digits (narrow and wide letters allowed), space width |
| Spacing | overridden side bearings against automatic spacing; closest approach and average gap in about 40 pairs, against the gap between straight stems; classic kerning pairs; extreme or dangling kerning |
| Font information | placeholder or long name, style vs. flags, copyright, licence, link, confirmation |
| Exported file | the read-back of the real `.ttf`/`.otf` |

A fresh typeface has **no blocking findings** in any family (tested). It does report, truthfully: the five undesigned symbols, the missing copyright/licence/name, kerning candidates (TA, AV, LT…, because the generator writes no kerning), and in the rounded family the `e` that dips 20 units below the baseline overshoot (the known spur in `typeface-engine.md`). Applying the suggested kerning clears the recommendation, never brings a pair under 40 units, and is idempotent (tested for all three families).

Thresholds were set from measurements of the three generated families and are heuristics: the numbers are shown so you can disagree.
