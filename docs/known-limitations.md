# Known limitations

Everything outstanding that a user, a reviewer or a maintainer should know before relying on Tynovo. Nothing here is hidden elsewhere; the website's "Early version" and "In development" labels come from `src/modules/marketing/content.ts` and are meant to match this list.

## The product

- **Typeface generator.** Draws all **95 printable ASCII characters**. **Latin only, by decision:** no accented letters and no other scripts (Greek, Cyrillic, Arabic, Indic, CJK). The website says so.
- **Glyph editor.** Points and **quadratic** Bézier curves (TrueType's curve type): control points, split, smooth, and *Fit curves* for the short straight sides a generated letter is drawn with. **No cubic handles**; OpenType/CFF export converts each quadratic curve to a cubic of the same shape, with control points rounded to whole units (a unit or so of difference at most). Generated glyphs are still drawn as straight sides until curves are fitted or added.
- **Export formats.** TrueType (`.ttf`), OpenType/CFF (`.otf`), WOFF and WOFF2 (the TrueType file in a container; no variable or colour fonts, no CFF-flavoured web fonts). The **PDF specimen** is drawn by Tynovo in the browser with real text; it embeds your typeface and the bundled catalog fonts it uses, and draws any font you only named in Helvetica (it cannot embed a font it does not have).
- **Font catalog.** 52 fixed families, all SIL OFL 1.1 (not every font: the set is chosen, and bundling a family is a deliberate step, see `npm run catalog`). A font named from the user's device is checked by a **heuristic** ("detected" / "not detected"), not proof.
- **Brand direction, roles, pairing.** Catalog ordering and pairing suggestions are fixed, readable scoring rules, not an AI model; suggestions are an aid, not a verdict. Optional AI boxes (a brand direction from a brief; typeface settings from a description) use Groq through `api/ai.ts`. They are best-effort: a language model's suggestion is a starting point, the answer is clamped to what Tynovo accepts, nothing is applied without a click, and the rate limit is per function instance, not a global quota (`docs/ai-assist.md`). There is no AI pairing explanation or AI-written sample copy yet. The model currently used is `openai/gpt-oss-120b` with fallbacks; Groq can retire or rename models, which the function survives by trying the next one.
- **Previews.** Website, editorial, product screen, poster and a printed document (an A4 page, always on white paper; a preview, not a print job).
- **No accounts, sync, database or payments.** (One stateless function exists for the AI boxes.) Paid plans do not exist (`docs/monetisation-architecture.md`). Everything shipped is free.

## Where it has and has not been tested

- **Browsers.** All automated and manual checking was in **Chromium** (desktop, plus phone-sized viewports emulated in Chromium). Firefox, Safari and real mobile devices are untested.
- **Fonts in other software.** Exports validated with fontTools, fontkit, CoreText and Chromium (`docs/font-export-validation.md`). **Not tested:** Figma, Illustrator, Glyphs, Windows applications, Firefox, Safari. Install an exported font in your own tools and look at it.
- **Accessibility.** Machine-checked at WCAG 2.2 AA and tested for keyboard, focus, announcements and reduced motion; **no screen-reader testing**, no 320px reflow, text-spacing or forced-colors testing. See `docs/accessibility.md`. No conformance claim is made.
- **Deployment.** Verified against the production build served locally with the production headers. **Not yet verified on the live host:** the 404 behaviour, the headers as served by Vercel, Lighthouse / Web Vitals. GitHub Pages is untried (and cannot send the security headers or serve from a sub-path without further work).

## Storage and data

- Projects live only in one browser profile on one origin. Clearing site data, a different browser, a different device or a changed domain loses sight of them; browsers may also evict storage. **Tynovo does not request persistent storage** (`navigator.storage.persist()`), which would reduce the eviction risk. Export a project file to back up. See `docs/storage-and-recovery.md`.
- Imported files over **25 MB** are refused. A project may have at most 5,000 kerning pairs, 32 contours per glyph and 4,000 points per contour.
- A project saved by a *newer* version cannot be opened by an older one (it is kept, listed as unreadable and downloadable). This limits rollback across a schema change (`docs/deployment.md`).

## Security and legal

- The Content-Security-Policy is delivered as HTTP headers, so it applies only on hosts that send them (Vercel does, via `vercel.json`). No CSP reporting endpoint.
- **No external security audit or penetration test.**
- **The Privacy, Terms and Licensing pages have not been reviewed by a lawyer**, and no jurisdiction is chosen. They are accurate to the code as tested, not legal advice.
- Tynovo is **GPL-3.0-only** because it uses Font Flux JS (GPL-3.0-only). Fonts a user exports carry the licence the user chooses.
- One shipped package (`splaytree`, MIT) carries no licence file; the generated notices say so.

## Performance

- The first visit loads about 162 KB of gzip JavaScript, including a 28 KB schema (Zod) chunk the marketing home page does not strictly need.
- `dist/` carries a 1 MB `brotli_wasm_bg.wasm` from Font Flux that Tynovo never requests (it costs deploy size, not visitors).
- Runtime figures are from one laptop in headless Chromium (`docs/performance.md`); there is no measurement on low-end devices.

## Code quality

- `npm run lint` reports **3 warnings, no errors** (`react-hooks`/`react-refresh` rules: two `set-state-in-effect` in `DashboardPage.tsx` and `useProjectEditor.ts`, one `only-export-components` in `LicensingPage.tsx`). Each predates Phase 7 and is a style rule, not a defect.
- The browser tests need ports 4173 free and run only in Chromium.

## Navigation

- There are **no section tabs**: the workflow bar is the one way around a project (Fonts, Roles, Typeface and Export are steps; Settings and Export also sit in the project header). Its markers are numbered; the current step is filled, and step names show in full only from 1536 px wide (below that only the current step is named; the Workflow panel lists all).
- **Help** is a side panel (`app-shell/help/`), opened from the top bar or the `?` key, that follows the current screen. All side panels (`shared-ui/Drawer`) dim the page with a scrim, close on a press outside, and slide in from the right and out to the right; only one of Help and Workflow is open at a time.
- The **workflow bar** (`app-shell/workflow/`) is on every screen of a project, sticky under the top bar. It reads the same eight steps as the Overview list (`brand-system/workflow.ts`); which step is "current" follows the screen and the `#section`, and Validate and Export both live on the Export screen, so only Export is marked there. Motion: the bar and list use short fades and one arrival wash; with reduced motion the movements stop and the wash is a plain fade. A page's own `scroll-padding` keeps anything focused or jumped to below the two sticky bars (`index.css`).
