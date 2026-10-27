# Accessibility

Target: **WCAG 2.2 level AA** where it applies. This page records what was checked by machine, what was checked by test, what was changed because of it, and what has **not** been checked by a person with assistive technology.

## Automated: axe-core, WCAG 2.2 AA, every impact level

`e2e/accessibility.spec.ts` runs axe with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (this includes colour contrast and the 2.2 target-size rule) and fails on a violation of **any** impact, not only serious ones. It runs at desktop (1280×800) and phone (390×844) widths over:

- every public page and the not-found page;
- the projects dashboard, Settings and the Font lab;
- every project section (overview, font catalog, brand typography system, typeface creator, export, project settings) and every typeface view (preview, glyphs, variants, coverage, quality, font info);
- busy states: the new-project drawer open, a glyph selected in the editor, brand suggestions and pairings shown, the font catalog ordered by a brand direction, and the export drawer after a font was built.

Result: no violations in any of them. The test waits for animations to finish first, because a drawer that is half-faded reports a contrast no one sees.

## Tested behaviour (not just markup)

| Requirement | How it is checked |
|---|---|
| Keyboard access, bypass blocks (2.1.1, 2.4.1) | The first Tab stop on the website and the app is "Skip to content", and Enter moves into the main content. Glyph point editing, undo/redo and the editor tools are operated from the keyboard in `e2e/editor.spec.ts`. |
| Visible focus (2.4.7) | 45 consecutive Tab stops across a full typeface workspace: every focused control shows a 2px outline or ring. (A 2px outline is a sensible size, not a test of the AAA Focus Appearance criterion, 2.4.13.) |
| Focus management for drawers | The new-project drawer takes focus (to its autofocus field), closes on Escape, and **returns focus to the button that opened it**. |
| Focus not obscured (2.4.11) | At 640px wide or less a drawer covers the page, so everything behind it is made `inert` while it is open: Tab, click and assistive technology cannot reach the page underneath. Tested at phone width. On wider screens the drawer is deliberately non-modal and the page stays usable. |
| Error identification (3.3.1) and announcements (4.1.3) | Errors and warnings are `role="alert"`; confirmations and notes are `role="status"`. The save indicator is a polite live region. Tested for an import error, a failed save (full storage), unavailable storage and a two-tab conflict. |
| Not colour alone (1.4.1) | Every banner has an icon and a word: **Error**, **Warning**, **Done** (visible) or a read-out "Note". Quality findings show an icon and a severity label ("Blocks export", "Warning", "Recommendation"); the save indicator uses words ("Could not save", "Changed elsewhere"). Tested: an error banner contains the word "Error" and an icon. |
| Reduced motion (good practice; 2.3.3 is level AAA) | With `prefers-reduced-motion: reduce`, no element has a transition or animation longer than a blink (checked across the whole DOM with a drawer open). The rule is one global block in `src/index.css`. |
| Label in name (2.5.3) | axe's `label-content-name-mismatch` rule over the catalog and project pages. |

## Defects found and fixed in this phase

1. **Status was carried by colour alone** in every banner (error, warning, done, note). Each now has an icon and a word.
2. **A drawer lost focus on close**: its autofocus field made the drawer record the wrong "opener", so Escape dropped focus to the page body. All drawers (new project, font catalog, font export) now return focus to the real opener.
3. **On a phone, Tab reached the page hidden behind a drawer** (skip link, menu, import, new project, project cards). The page is now inert while a full-width drawer is open.
4. **Buttons whose accessible name did not contain their visible text** ("Add to project" labelled "Add Inter to project"; "Use this pairing" labelled "Use Inter with Lora"). Labels now start with the visible text ("Add to project: Inter").

## Not done: what a person must still check

- **No screen-reader pass.** Nothing was run in NVDA, JAWS, VoiceOver or TalkBack. Markup, names, roles and live regions are checked by axe and by tests, but how they *sound* has not been judged.
- **The glyph canvas** is an `application` with keyboard commands; its instructions and the spoken feedback for point moves need a screen-reader review.
- **Reflow at 320px, 400% zoom, text spacing overrides (1.4.10, 1.4.12) and Windows high-contrast / forced-colors mode** were not tested; phone width tested is 390px.
- **Pointer alternatives (2.5.7):** dragging points on the canvas has a keyboard equivalent, but no review has confirmed it covers every drag.
- **Only Chromium** was used. Safari and Firefox focus behaviour (for example, Safari does not focus a button on click, so focus-return after closing a drawer opened by mouse may not apply there) is untested.
- Contrast was checked by axe on the rendered pages. Colours in exported material (the HTML specimen, previews of the user's own brand colours) are the user's and are not audited.

A conformance claim should not be made until these are done.
