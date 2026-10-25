import { PUBLIC_PAGES } from './seo-config'

/** Look up page metadata by path so pages cannot drift from the sitemap/pre-rendered metadata. */
export function metaFor(path: string) {
  const page = PUBLIC_PAGES.find((p) => p.path === path)
  if (!page) throw new Error(`No metadata configured for ${path}`)
  return page
}
