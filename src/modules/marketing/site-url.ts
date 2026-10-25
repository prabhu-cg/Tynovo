import { normalizeSiteUrl } from './seo-config'

/** Configured at build time with VITE_SITE_URL; empty means canonical/OG URLs are simply omitted. */
export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined)
