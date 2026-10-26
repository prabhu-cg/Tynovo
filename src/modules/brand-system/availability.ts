import type { FontSource } from '@/modules/brand-projects/schema'
import { catalogFontFor } from '@/modules/font-catalog/catalog'
import type { Installed } from '@/modules/font-catalog/installed'
import type { LoadState } from '@/modules/font-catalog/loader'

/**
 * Whether a font can actually be drawn right now. A font is never described as available unless it is loaded
 * (catalog) or detected on this device (named). Everything else says what is missing and what happens instead.
 */
export type Availability =
  | { status: 'loaded' }
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'installed' }
  | { status: 'not-detected' }
  | { status: 'unknown' }

export interface AvailabilityInput {
  /** Load state of the weights the project's roles use, for a catalog font. */
  load: LoadState
  loadError?: string | undefined
  installed: Installed
}

export function sourceAvailability(source: FontSource, input: AvailabilityInput): Availability {
  if (source.kind === 'catalog') {
    if (!catalogFontFor(source.family)) return { status: 'unavailable', message: `${source.family} is no longer in Tynovo's catalog, so it cannot be loaded.` }
    if (input.load === 'loaded') return { status: 'loaded' }
    if (input.load === 'failed') return { status: 'failed', message: input.loadError ?? 'The font file could not be loaded.' }
    return { status: 'loading' }
  }
  if (source.kind === 'uploaded') return { status: 'unavailable', message: 'Uploaded fonts are not stored by Tynovo, so this one cannot be loaded.' }
  return input.installed === 'installed' ? { status: 'installed' } : input.installed === 'not-detected' ? { status: 'not-detected' } : { status: 'unknown' }
}

/** One plain sentence: what the preview shows for this font. */
export function describeAvailability(a: Availability, source: FontSource): string {
  switch (a.status) {
    case 'loaded': return 'Loaded. Previews use the real font.'
    case 'loading': return 'Loading the font file…'
    case 'failed': return `Could not be loaded (${a.message}). Previews show the fallback (${source.fallback}).`
    case 'unavailable': return `${a.message} Previews show the fallback (${source.fallback}).`
    case 'installed': return 'Detected on this device. It will only draw for people who also have it installed, because exports do not include its file.'
    case 'not-detected': return `Not detected on this device, so previews show the fallback (${source.fallback}). Install the font, or supply its file separately.`
    case 'unknown': return 'This browser cannot check whether the font is installed.'
  }
}

/** True only when the font is really drawn. */
export const isDrawable = (a: Availability) => a.status === 'loaded' || a.status === 'installed'
