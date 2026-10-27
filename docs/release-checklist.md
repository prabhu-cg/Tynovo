# Release checklist

Work top to bottom. A box is ticked only when someone has done the step against the build being released; do not tick from memory. Steps marked **(person)** cannot be automated and have not been done by the tooling.

## 1. Automated gate

- [ ] `git status` is clean, on the commit being released.
- [ ] `npm ci`
- [ ] `VITE_SITE_URL=<production URL> npm run check` passes: type check, lint (no errors), unit tests, production build, size budgets, output verification.
- [ ] `npm audit --omit=dev` reports 0 vulnerabilities (or each finding is judged and written down).
- [ ] `npm run e2e` passes in full (builds with a test URL and previews it under the production headers). A failure is investigated, not re-run until green.
- [ ] If the project schema changed: the migration tests pass and the **rollback note** in section 5 applies.

## 2. Manual verification against the production build

Serve it as a visitor gets it: `VITE_SITE_URL=<url> npm run build && npm run preview`.

- [ ] **(person)** Website: every nav link, footer link and call to action on all nine pages goes where it says; the home page "Start a project", "Open the sample project" and "Try the font lab" and the header "Open Tynovo" button work; no console errors.
- [ ] **(person)** Responsive: home, features, pricing and the app dashboard at phone, tablet and desktop widths; no horizontal scroll; the nav menu works.
- [ ] **(person)** Create a project, edit it, reload, close the tab and reopen the browser: the project is still there and unchanged.
- [ ] **(person)** Typeface: start each family, change parameters, edit a glyph by keyboard and by pointer, undo/redo, reset a glyph.
- [ ] **(person)** Export every format offered: TrueType, OpenType/CFF, specification, CSS, tokens, specimen, sources and licences, zip, project file. Open each; import the project file into a fresh profile.
- [ ] **(person)** Install an exported font in the design tools you rely on and look at it. The automated validation (`docs/font-export-validation.md`) covers fontTools, fontkit, CoreText and Chromium only; Figma, Illustrator, Glyphs, Windows applications, Firefox and Safari have **not** been tested.
- [ ] **(person)** Accessibility pass with a screen reader (VoiceOver or NVDA) on the dashboard, the font catalog and the glyph editor, and with the keyboard alone. See `docs/accessibility.md` for what is not yet covered.
- [ ] **(person)** Failure paths: fill the disk quota or block site data in a private window; confirm the messages (tested in Chromium by `e2e/storage-failures.spec.ts`).
- [ ] **(person)** The legal pages (Privacy, Terms, Licensing) still describe the product. They have **not been reviewed by a lawyer**; do that before a launch that relies on them.
- [ ] The "Early version" / "In development" labels on the website match `src/modules/marketing/content.ts` and the real state of the product.

## 3. Deploy

- [ ] `VITE_SITE_URL` is set for the Production environment on the host (not committed).
- [ ] Deploy a **preview** first (`vercel`) and run section 4 against it.
- [ ] Promote / deploy to production (`vercel --prod`, or merge to the production branch).

## 4. Verify the deployed site

Run the `curl` checks in `docs/deployment.md` ("Verifying a deployment") and confirm:

- [ ] Security headers are present on `/` and on `/app/projects` (CSP, nosniff, referrer policy, frame protection, permissions policy, HSTS).
- [ ] `/app/projects/anything` returns the app (200) and a refresh on a nested route works; an unknown address returns 404 with the not-found page. **This has not been confirmed on the live site yet.**
- [ ] `robots.txt`, `sitemap.xml` (all indexable pages, canonical host correct), `/third-party-notices.txt`, `/og.png`, favicons all return 200.
- [ ] Open the live site once with the browser console open: no CSP violation, no failed request.
- [ ] Build and download a TTF and an OTF on the live site and run `scripts/verify-font.py --coretext` on them.
- [ ] Record Lighthouse / Web Vitals for `/` and `/app/projects` in the release notes (not yet measured).

## 5. Rollback

Triggers: a core workflow (create, save, reload, export, download) fails for anyone; data is lost or unreadable; a security header or the CSP breaks the app; a legal page is wrong.

1. **Roll back the deployment**: Vercel dashboard → Deployments → previous production deployment → *Instant Rollback* (or `vercel rollback`). This is immediate and rebuilds nothing.
2. **Make it stick**: `git revert` the faulty commit(s) and push; otherwise the next deploy brings the fault back.
3. **Schema warning.** If the faulty release bumped the project schema (`CURRENT_SCHEMA_VERSION`), people may already have saved projects in the new format. The old code *refuses* them (listed as unreadable, left untouched, downloadable raw); nothing is destroyed, but they cannot be opened until you roll forward again. Prefer a quick forward fix over a rollback across a schema bump; if you must roll back, post a notice and tell people to export their project files.
4. Re-run section 4 against the rolled-back site.
5. Write down what happened and add a test that would have caught it.

## 6. After release

- [ ] Tag the commit and note: version, date, what changed, known limitations (`docs/known-limitations.md`), and the verification above that was **not** done.
