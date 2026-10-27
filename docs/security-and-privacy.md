# Security and privacy

Tynovo has no server, account or database, so its attack surface is the browser page itself and the files people import and export. This document records the controls, how each is tested, and what is not covered.

## Untrusted input

Everything a person types, and every file they import, is treated as untrusted.

| Input | Control | Test |
|---|---|---|
| Imported project file | Size cap of 25 MB checked before the file is read (`MAX_IMPORT_BYTES`); parsed as JSON only (never evaluated); validated field by field with a Zod schema that bounds every string, number and array (including 5,000 kerning pairs, 32 contours per glyph, 4,000 points per contour); unknown format, wrong type or bad JSON is refused with a reason. Nothing is half-imported. An id clash becomes a copy, never an overwrite. | `recover.test.ts`, `e2e/hardening.spec.ts` |
| Damaged stored project | Listed as unreadable, left untouched; the readable parts can be recovered into a *new* project on request. | `recover.test.ts` |
| Text in names, notes, sample copy, role names, font names | React renders text as text; there is no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `document.write` anywhere in `src/`. | `e2e/hardening.spec.ts` (markup in a project name is shown literally and nothing runs) |
| The same text inside exported files | HTML specimen: every interpolation goes through `escapeHtml`; CSS: strings through `cssString`, comments through `cssComment`; JSON tokens through `JSON.stringify`. | `export-centre.test.ts` puts hostile text (`</style><script>…`, `"; } body{…}`) in every user-written field at once and checks the specimen, CSS, tokens, specification and manifest stay inert |
| Prototype pollution via a crafted file | `JSON.parse` plus schema validation builds fresh objects; `__proto__` keys do not reach application objects. | `e2e/hardening.spec.ts` |

## Content-Security-Policy and headers

Set in `vercel.json` for every response (and mirrored by `vite preview`, so the browser tests run under it):

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
font-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

There is **no `unsafe-inline` and no `unsafe-eval`**: the build emits no inline script or style, and `verify:dist` and the browser tests fail if one appears. `data:` is allowed for images and fonts because the stylesheet draws the select chevron from a data URI and the HTML specimen embeds the font as base64; `blob:` is allowed because downloads and generated fonts are blobs. `connect-src 'self'` means the page cannot talk to any other origin even if something tried to.

Also sent: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (with `frame-ancestors 'none'`), `Permissions-Policy` (camera, microphone, geolocation, payment, USB all denied), `Cross-Origin-Opener-Policy: same-origin`, and `Strict-Transport-Security` (two years, without `includeSubDomains` so it cannot affect other subdomains of a custom domain).

Tested in `e2e/hardening.spec.ts`: the headers are present on the website and the app; every public page and the whole core workflow (project → fonts → typography → typeface → preview → export → download) run with **no policy violation, no script error and no request to another origin**.

**Not covered:** the policy is delivered as HTTP headers, so a host that cannot send headers (GitHub Pages) serves the site without it. There is no `report-uri`/`report-to` endpoint, because Tynovo has nowhere to receive reports.

## Third parties, tracking and transmission

- No analytics, tracking scripts, cookies, fingerprinting or advertising. No third-party script, font, image or stylesheet is loaded; all 24 catalog fonts and the interface font are served from the same origin.
- A project is never transmitted. Tested: after a full session (create, edit, build and download a font) the browser holds no cookie, no `localStorage` or `sessionStorage` entry, no Cache Storage, no service worker, and exactly one IndexedDB database. The one exception is two display preferences, each written only when the person uses it and each a single short value in `localStorage`: collapsing the sample project (`tynovo.sampleCollapsed`) and choosing Light or Dark (`tynovo.theme`; choosing System removes it). Tested: those are the only keys, nothing is sent, there are still no cookies; every request the page made was a plain `GET`/`HEAD` to its own origin (`e2e/hardening.spec.ts`, "what the privacy notice says is true").
- The only data anyone receives is what any web host sees for a request (IP address, time, address requested, browser). That is held by the host (Vercel), not by Tynovo. The user-facing statement is the [Privacy page](../src/modules/marketing/PrivacyPage.tsx); if behaviour changes, change that page in the same commit.

## Secrets

The app needs none. Only variables starting with `VITE_` can reach the bundle, and the only one defined is the public site URL. `npm run verify:dist` scans every text file in `dist/` for the value of any secret-looking environment variable (from the process environment and from `.env`, `.env.local`, `.env.production*`) and for common credential shapes (JWTs, private keys, AWS/GitHub/Slack/Stripe/Vercel tokens), and fails the build on a hit. It also fails if a source map is published. The checker itself was proved against a planted token, JWT, Stripe-style key and source map.

`.env.local` (which the Vercel CLI fills with an OIDC token) is git-ignored via `*.local`.

## Dependencies and licences

- `npm audit --omit=dev`: **0 vulnerabilities** (2026-10-27). Re-run before each release.
- Production dependencies (43 lock entries, 40 shipped; the other three are type-only): MIT, ISC, Apache-2.0, Unlicense, MIT+Zlib, the SIL Open Font License 1.1 for the 26 font packages, and **GPL-3.0-only for Font Flux JS**, which is why Tynovo is GPL-3.0-only (a deliberate decision recorded in the README and on the Licensing page). All are compatible with that.
- `third-party-notices.txt` is generated at build time from the installed packages and reproduces every licence text (34 distinct), and is linked from the Licensing page. One MIT package (`splaytree`) ships no licence file; the notices say so.
- Exported fonts carry the licence the *user* chooses; no third-party font file is ever put in an export (`manifest.ts` records this).

## Reporting a problem

Open an issue on the project's tracker without exploit details and ask for a private channel (stated on the Privacy page).

## Not reviewed

- The legal pages (Privacy, Terms, Licensing) are accurate to the code as tested above but **have not been reviewed by a lawyer**, and no jurisdiction is chosen. The pages say so. A launch that depends on them should have them reviewed.
- No penetration test or third-party audit has been done.
