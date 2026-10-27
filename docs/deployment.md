# Build and deployment

Tynovo is a static site: `npm run build` produces `dist/`, which any static host can serve. There is no server, database or API, and no secret is needed to build or run it.

## What you need

- Node.js **23.6 or newer** (the post-build step imports TypeScript directly; Vercel's default Node 24 is fine). `package.json` declares this in `engines`.
- npm (the repository has a `package-lock.json`; use `npm ci`).

## Environment variables

There is exactly one, and it is public:

| Variable | Required | Meaning |
|---|---|---|
| `VITE_SITE_URL` | for production builds | The public address of the site with no trailing slash, e.g. `https://gettynovo.vercel.app`. Used for canonical links, Open Graph URLs, `sitemap.xml` and `robots.txt`. |

Without it the app works and the build prints a warning; canonical URLs and the sitemap are skipped. `.env.example` shows the format. Anything starting with `VITE_` is written into the public JavaScript, so **never put a secret behind that prefix**. `npm run verify:dist` fails the build output if the value of any secret-looking variable (`TOKEN`, `SECRET`, `KEY`, `OIDC`, …) from the environment or from `.env*` files appears in `dist/`.

`.env.local` is git-ignored. The Vercel CLI writes a `VERCEL_OIDC_TOKEN` into it; that token is for the CLI and must stay out of the repository and the bundle.

## Build

```sh
npm ci
VITE_SITE_URL=https://your-domain.example npm run build   # tsc -b, vite build, postbuild
npm run budgets                                            # size budgets (docs/performance.md)
VITE_SITE_URL=https://your-domain.example npm run verify:dist   # production-output checks
```

`npm run check` runs type check, lint, unit tests, build, budgets and the output checks in one go. Run the browser tests too: `npx playwright install chromium` once, then `npm run e2e`.

`postbuild` does four things after Vite: pre-renders each public page's `<head>` (title, description, canonical, Open Graph) into `dist/<route>/index.html`; writes `404.html`, `robots.txt` and `sitemap.xml`; and writes `third-party-notices.txt` (the licence text of every shipped package, fonts included).

## Vercel (the supported target)

`vercel.json` holds everything the host needs:

- **SPA fallback.** `/app/:path*` is rewritten to `/index.html`, so refreshing or opening `/app/projects/<id>/typeface` directly works. Marketing routes are real files (`/privacy` → `privacy/index.html`). Any other address should get `404.html` with a 404 status (Vercel's documented behaviour for a static output directory; the check in *Verifying a deployment* confirms it, and it has not yet been confirmed on the live site), and the router then shows the not-found page.
- **Security headers** on every response: a strict Content-Security-Policy (no inline script or style, no third-party origin), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security`. See [security-and-privacy.md](security-and-privacy.md) for the reasoning.
- **Caching.** `/assets/*` is content-hashed and cached for a year (`immutable`); HTML is not.

Project settings: framework preset *Vite*, build command `npm run build`, output directory `dist`, and `VITE_SITE_URL` set for the **Production** environment. Deploy with `vercel` (preview) or `vercel --prod`, or let the Git integration do it.

`vite preview` serves the same headers (it reads them from `vercel.json`), so the browser tests run under the production policy.

## Another static host

The build is host-neutral, but two things do not move with it:

1. **Headers.** `vercel.json` is Vercel-specific. On another host, set the same headers in that host's configuration (copy them from `vercel.json`). Without the CSP the site still works; it just loses a layer of defence.
2. **Fallback.** Configure the host to serve `/index.html` for `/app/*`.

**GitHub Pages** can serve the build only from the root of a domain (a user site or a custom domain). It cannot be served from a project path such as `user.github.io/repo/`, because the built files use absolute paths (`/assets/…`); supporting that needs a `base` setting that has not been added or tested. GitHub Pages also cannot send custom headers, and for `/app/*` it would answer with `404.html` (the app shell, which works) but with a 404 status. Treat it as possible but unverified; it has not been tried.

## Verifying a deployment

After deploying, from any machine:

```sh
URL=https://your-domain.example
curl -sI $URL/                       | grep -iE "^(HTTP|content-security-policy|x-content-type-options|strict-transport)"
curl -sI $URL/app/projects/anything  | head -1        # 200: the SPA fallback
curl -sI $URL/no/such/page           | head -1        # 404
curl -s  $URL/robots.txt; curl -s $URL/sitemap.xml | head
curl -sI $URL/third-party-notices.txt | head -1       # 200
```

Then open the site in a browser and work through the manual steps in [release-checklist.md](release-checklist.md).

## Rollback

Code and data are separate: the code is on the host, the person's projects are in their own browser. That shapes rollback.

- **Roll back the site** from the Vercel dashboard (Deployments → a previous production deployment → *Instant Rollback*) or `vercel rollback`. It is immediate and does not rebuild. To make it permanent, `git revert` the faulty commit and deploy; otherwise the next push redeploys the fault.
- **Do not roll back across a project-schema bump without thinking.** Projects are saved with a `schemaVersion` (currently 4). A project saved by a *newer* app is refused by an older one, not truncated: it appears under "unreadable", is left untouched, and can be downloaded raw. So rolling back past a schema change does not destroy anything, but it makes projects saved since then unopenable until you roll forward again. If you must roll back across a bump, say so on the site and tell people to export project files first.
- A rollback never touches anyone's saved projects; there is nothing server-side to restore.
- Font packages and other dependencies are pinned by `package-lock.json`, so redeploying an old commit rebuilds the same site.
