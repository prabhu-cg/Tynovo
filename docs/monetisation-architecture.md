# Free and paid architecture (Phase 6)

## What exists, and what does not

**Exists:** a central, configurable, tested *entitlement layer* that decides which features a plan includes, and interface that respects it. At launch every shipped feature is in the free configuration, so nothing a person can do today has changed.

**Does not exist:** accounts, a server, payment, prices, plans anyone can buy, or any way to become "paid". There is no checkout, upgrade or sign-in control anywhere in the application (an end-to-end test scans every screen), the settings page says there is no payment system, and `COMMERCE.paymentsAvailable` is `false` in code. The public pricing page still says paid options are undecided. Do not describe any of this as a billing system.

The studio stays fully usable without an account or a backend.

## Rules the code enforces

1. **Data is never a plan decision.** Four *essential* features (local projects, project-file export, import, upgrade/recovery) are always allowed: the resolver returns `essential` before it looks at any tier, and configuration validation rejects any file that tries to restrict them.
2. **Free promises are validated.** Features marked `guaranteedFree` (roles, scale, basic pairing, CSS and documentation exports, a procedural family, basic glyph editing, TrueType export, the essential four) must be granted by the default tier, and no other tier may take them away. A configuration that breaks this does not load.
3. **Shipped features stay free until someone decides otherwise.** The launch configuration grants every implemented feature to the free tier. Moving a shipped feature behind a paid tier is a product decision with a grandfathering question (below); the architecture makes it a one-line data change plus that decision.
4. **A claim from the browser is never proof of payment.** A `Grant` carries `trusted`. An untrusted grant for any tier other than the default is ignored (`downgraded: true`). In a production build nothing can create a trusted grant for a paid tier: there is no code path reading storage, cookies, the address or globals. The only richer grant is a *development preview* (`?plan=` in a dev build), which the build removes from production (a test greps `dist/` for it) and which shows a banner saying it is not a purchase.
5. **User data is never removed or hidden because of a plan.** Over-limit data stays (saving a variant at the limit is refused instead of dropping the oldest; variants already kept stay visible, usable and deletable). A typeface in a family the plan does not include stays editable as that family. Settings already on a glyph keep applying even when new per-glyph settings are locked.
6. **Capability is separate from visibility.** `resolve.ts` answers "may this happen?"; `presentation.ts` answers "what do people see when not?" (`show-locked` with a plain sentence, or `hide`). Every code path that performs an action checks the capability, not just the control that is drawn (the keyboard shortcut for inserting a point, the export download handler, `saveVariant`'s `limit`).
7. **No prices or plan rules in the interface.** Components ask `useFeature('some.feature')`, never about a plan's name. The only plan word shown is the configured label. Messages never contain prices or calls to action (tested over every feature).

## The layers

| Layer | File | Holds | Must not hold |
|---|---|---|---|
| Registry | `entitlements/features.ts` | what each feature is, essential / guaranteed-free flags, whether it exists, where it is enforced | which plan has it |
| Configuration | `entitlements/config.ts` | tiers, labels, `extends`, grants (booleans and limits), validation | prices, billing terms, behaviour |
| Resolution | `entitlements/resolve.ts` | `resolveCapabilities(config, grant)` → `allows`, `limit`, `decide` | UI, storage, the network |
| Grant source | `entitlements/source.ts` | where the grant comes from (default tier; dev preview) | anything that could prove payment |
| Presentation | `entitlements/presentation.ts` | locked behaviour per feature, the locked sentence, `COMMERCE` | availability decisions |
| Interface | `app-shell/entitlements.ts`, `EntitlementsProvider.tsx` | context and hooks | rules |

Changing a plan's contents means editing the configuration data (or the registry for a new feature) and running the tests; no component changes.

## What is enforced where

Implemented, restrictable features and their enforcement points (each also listed in `features.ts` as `enforcedIn`):

| Feature | Kind | Enforced in |
|---|---|---|
| `typeface.family.geometric` / `.rounded` / `.modular` | flag | `CreateTypeface.tsx`, `DnaPanel.tsx` |
| `typeface.variants.explore` | flag | `VariantsTab.tsx` |
| `typeface.variants.maxSaved` | limit (ceiling 60) | `typeface-engine/edit.ts` (`saveVariant`), `VariantsTab.tsx` |
| `glyph.edit.structure` (add/delete points) | flag | `GlyphWorkspace.tsx` (all routes: buttons, keys, double-click), toolbar, inspector |
| `glyph.edit.curves` (curve, line, smooth, fit curves) | flag | `GlyphWorkspace.tsx` (every command goes through `run`), toolbar, inspector |
| `glyph.edit.shape-params` | flag | `GlyphWorkspace.tsx`, `GlyphInspector.tsx` |
| `quality.extended` | flag | `font-validation/quality.ts` (`extended` option), `QualityTab.tsx`, `FontExportFlow.tsx` |
| `export.font.ttf` / `export.font.otf` | flag | `FontExportFlow.tsx`, `ExportPage.tsx` |
| `export.css`, `export.docs`, `export.specimen`, `export.package` | flag | `ExportPage.tsx` (mapping in `export/exportFeatures.ts`) |

Checks that guard the *correctness* of an exported file (coverage, geometry, mapping, metadata, the file read-back) are `core` and always run: a plan can drop advice, never a safeguard (tested: with extended checks off, every blocking finding is still reported, and extended checks can never block).

Registered but **not built** (never shown): additional typeface families, additional weights and styles, extended specimen options, advanced project organisation. They exist only so a configuration can say who gets them once they do.

## Limits of enforcing a paid entitlement without a trusted server

The studio is local-first and open source (GPL-3.0-only). Everything above runs in code the person controls, so it is a **product boundary, not a security boundary**:

- Anyone can edit IndexedDB, call the functions from the console, change the bundle, or run a modified build. Client-side checks cannot stop that, and signing a grant on the client changes nothing, because the key and the check live where the attacker is.
- The GPL gives recipients the right to modify and redistribute the program, and does not allow adding restrictions to that right. A premium code path shipped in this program cannot be made exclusive; a "locked" feature in the client is a convenience for honest users.
- Therefore the only things that can be sold securely are things the *server* holds or does: hosted storage and sync, collaboration and sharing, server-side generation or delivery of premium assets (families, fonts, templates delivered per request after an entitlement check), hosted export services, support. Anything delivered to the browser can be saved by whoever receives it.
- Premium font assets also need their own licence terms for redistribution; do not ship them inside the open-source bundle. (This is a design note, not legal advice: have the licensing reviewed before selling.)

What the local layer is still good for: honest presentation of what a plan includes, one place to change it, tests that protect the free promises, and a ready seam (`source.ts`) for a real grant later.

## What must change before a secure paid release

1. **Decide what is sold.** It must be service-backed (see above). Selling a switch inside the GPL client cannot be enforced.
2. **Identity.** An authentication provider, an account model, session handling, account deletion and data export for the account itself. Update the privacy notice and terms (both are drafts today) and legal review them. Introduce accounts only when a service that needs them (sync, sharing, billing) is a demonstrated need; the free experience must keep working without one.
3. **A trusted entitlement service.** Server-side records of what each account is entitled to, derived only from the payment provider's confirmed events. An endpoint returns a short-lived signed grant (for example a JWT or PASETO with account id, tier, expiry); the client verifies the signature only to decide what to *draw*. Real enforcement happens on the server for every premium resource or action. Define expiry, revocation, refresh, clock skew and an offline grace policy.
4. **Payment integration.** A provider's hosted checkout created *server-side*; webhooks with signature verification, idempotency and out-of-order handling as the *only* source of "paid"; a customer portal; refunds, disputes, failed payments and cancellation; tax and invoicing; prices live in the provider, never in this repository; test-mode end-to-end tests. Never treat a redirect back to the site, a query parameter or client state as payment.
5. **Replace the grant source.** Implement a `source.ts` that returns a grant verified by (3), keep `trusted: false` for everything else, keep the production-bundle test that proves no preview or override ships, and add contract tests for the grant format.
6. **Migration policy.** Existing users keep what they have: decide grandfathering before moving any shipped feature to a paid tier. Downgrades and lapsed plans never delete or lock a person's data (rules 1 and 5 already hold); they only stop new creation beyond the limits.
7. **Operations and law.** Rate limits and abuse handling, monitoring, support, consumer-law and refund terms, licence review of the GPL position and of any premium assets, accessibility of the new flows.

## Open decisions

Which service (if any) justifies accounts; whether any shipped feature should ever move behind a plan; plan names and labels (configuration, not code); the grandfathering policy.

## Tests that protect this

- `entitlements/entitlements.test.ts`: registry integrity, configuration validation (cannot restrict essential data, cannot drop a free promise, cannot take a promise away in a paid tier), resolution, the trust rule, clamping, presentation messages (no prices, no purchase wording).
- `font-validation/quality.tiers.test.ts`, `typeface-engine/edit.test.ts`: core checks always run; saving at a limit never drops data.
- `app-shell/entitlements.ui.test.tsx`: families, variants, glyph controls (including the keyboard), settings, with an injected restrictive configuration.
- `e2e/plans.spec.ts`: the free experience is complete with no external request; no purchase, upgrade or sign-in control on any screen; storage, cookies and the address cannot change the plan; the production bundle contains no preview.
