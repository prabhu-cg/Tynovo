import type { Grant } from './resolve'

/**
 * Where the grant comes from. In this version there is exactly one honest answer in production: everyone is on the
 * default tier, because Tynovo has no account and no server that could prove anything else.
 *
 * Replacing this file's `currentGrant` with a call that returns a grant verified by a server is the integration
 * point for paid plans; see docs/monetisation-architecture.md for everything that must exist first.
 */
/** A grant for the tier everyone has. It is "trusted" only in the sense that it grants nothing beyond the default. */
export const defaultGrant = (defaultTier: string): Grant => ({ tier: defaultTier, trusted: true, source: 'local-default', preview: false })

export interface PreviewEnv {
  DEV: boolean
}

/**
 * Preview another tier while building the product. This is NOT a purchase and NOT proof of one: it exists only in
 * development builds (Vite removes it from production bundles, which a test checks), and the interface says so
 * whenever it is in use.
 */
export function devPreviewGrant(tier: string, env: PreviewEnv = import.meta.env): Grant {
  if (!env.DEV) throw new Error('Tier previews exist only in development builds.')
  return { tier, trusted: true, source: 'dev-preview', preview: true }
}

/** The grant for this page load: the default everywhere, or a development preview when `?plan=` is in the address. */
export function currentGrant(defaultTier: string): Grant {
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    const plan = new URLSearchParams(location.search).get('plan')
    if (plan) return devPreviewGrant(plan)
  }
  return defaultGrant(defaultTier)
}
