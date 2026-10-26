import type { Tone, UseCase } from '@/modules/brand-projects/schema'

/**
 * The studio's own editorial tags for each catalogued font. These are judgements made by the people who built the
 * studio, NOT measurements and NOT font metadata: they exist to order suggestions and filters, and the UI says so.
 * Category, weights, styles and licences come from the font packages themselves (see catalog.data.ts).
 */
export interface FontTags {
  tones: readonly Tone[]
  uses: readonly UseCase[]
  /** Drawn for running text at small sizes. */
  text: boolean
  /** Has a distinct character that carries large sizes. */
  display: boolean
  /** Fonts of one designed family (a superfamily) share a key, so a pairing within it can be called out. */
  superfamily?: string
  /** One factual line about the design. */
  note: string
}

export const TAGS: Record<string, FontTags> = {
  'abril-fatface': { tones: ['confident', 'elegant', 'playful'], uses: ['campaign', 'editorial'], text: false, display: true, note: 'A fat-face display serif with heavy contrast; one weight.' },
  'bebas-neue': { tones: ['confident', 'playful'], uses: ['campaign', 'consumer'], text: false, display: true, note: 'Condensed, all-capitals sans for short headlines; one weight.' },
  caveat: { tones: ['friendly', 'playful'], uses: ['consumer', 'campaign'], text: false, display: true, note: 'A handwriting style for short accents.' },
  'dm-sans': { tones: ['friendly', 'confident'], uses: ['saas', 'consumer', 'campaign'], text: true, display: false, note: 'Low-contrast geometric sans with an optical size axis upstream.' },
  'dm-serif-display': { tones: ['elegant', 'confident'], uses: ['editorial', 'campaign', 'consumer'], text: false, display: true, note: 'High-contrast serif cut for large sizes; one weight.' },
  'eb-garamond': { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'A revival of the Garamond old-style serif.' },
  fraunces: { tones: ['elegant', 'playful', 'friendly'], uses: ['editorial', 'consumer', 'campaign'], text: true, display: true, note: 'A soft, old-style serif with a wide weight range.' },
  'ibm-plex-mono': { tones: ['technical'], uses: ['saas'], text: false, display: false, superfamily: 'ibm-plex', note: 'Monospace member of the IBM Plex family.' },
  'ibm-plex-sans': { tones: ['technical', 'serious'], uses: ['saas', 'corporate'], text: true, display: false, superfamily: 'ibm-plex', note: 'Sans member of the IBM Plex family.' },
  'ibm-plex-serif': { tones: ['technical', 'serious'], uses: ['editorial', 'corporate'], text: true, display: false, superfamily: 'ibm-plex', note: 'Serif member of the IBM Plex family.' },
  inter: { tones: ['technical', 'confident', 'serious'], uses: ['saas', 'corporate', 'consumer'], text: true, display: false, note: 'A neutral sans drawn for screens and interfaces.' },
  'jetbrains-mono': { tones: ['technical', 'playful'], uses: ['saas'], text: false, display: false, note: 'Monospace drawn for reading code.' },
  'libre-baskerville': { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'A Baskerville-style serif adapted for body text on screen.' },
  lora: { tones: ['elegant', 'friendly'], uses: ['editorial', 'consumer'], text: true, display: false, note: 'A contemporary serif with calligraphic roots, suited to body text.' },
  manrope: { tones: ['confident', 'friendly', 'technical'], uses: ['saas', 'consumer', 'campaign'], text: true, display: false, note: 'A modern semi-condensed sans with geometric shapes.' },
  merriweather: { tones: ['serious', 'friendly'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A sturdy serif designed for legibility on screens.' },
  'nunito-sans': { tones: ['friendly', 'playful'], uses: ['consumer', 'saas'], text: true, display: false, note: 'A well-balanced sans with softly rounded details.' },
  'playfair-display': { tones: ['elegant', 'confident'], uses: ['editorial', 'campaign'], text: false, display: true, note: 'A high-contrast transitional serif for titles and large text.' },
  'public-sans': { tones: ['serious', 'confident'], uses: ['corporate', 'saas'], text: true, display: false, note: 'A neutral sans developed for public-sector websites.' },
  'source-sans-3': { tones: ['serious', 'friendly'], uses: ['corporate', 'editorial', 'saas'], text: true, display: false, note: 'A humanist sans designed for user interfaces.' },
  'source-serif-4': { tones: ['serious', 'elegant'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A transitional serif with an optical size axis upstream.' },
  'space-grotesk': { tones: ['technical', 'playful', 'confident'], uses: ['saas', 'campaign', 'consumer'], text: false, display: true, note: 'A proportional sans derived from a monospace design.' },
  'space-mono': { tones: ['technical', 'playful'], uses: ['campaign', 'saas'], text: false, display: true, note: 'A monospace with geometric, idiosyncratic forms.' },
  'work-sans': { tones: ['friendly', 'serious'], uses: ['corporate', 'editorial', 'saas'], text: true, display: false, note: 'A grotesque-inspired sans tuned for on-screen text.' },
}
