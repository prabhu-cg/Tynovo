import type { Tone, UseCase } from '@/modules/brand-projects/schema'

/**
 * Tynovo's own editorial tags for each catalogued font. These are judgements made by the people who built the
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
  anton: { tones: ['confident', 'playful'], uses: ['campaign', 'consumer'], text: false, display: true, note: 'A condensed, heavy sans for headlines; one weight.' },
  'archivo-black': { tones: ['confident', 'serious'], uses: ['campaign', 'corporate'], text: false, display: true, note: 'A heavy grotesque sans for large sizes; one weight.' },
  'bebas-neue': { tones: ['confident', 'playful'], uses: ['campaign', 'consumer'], text: false, display: true, note: 'Condensed, all-capitals sans for short headlines; one weight.' },
  bitter: { tones: ['friendly', 'serious'], uses: ['editorial', 'consumer'], text: true, display: false, note: 'A slab serif with low contrast, designed for reading on screens.' },
  caveat: { tones: ['friendly', 'playful'], uses: ['consumer', 'campaign'], text: false, display: true, note: 'A handwriting style for short accents.' },
  'cormorant-garamond': { tones: ['elegant'], uses: ['editorial', 'campaign'], text: false, display: true, note: 'A Garamond-style serif with fine details, best at large sizes.' },
  'crimson-pro': { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'An old-style serif suited to book-like body text.' },
  'dancing-script': { tones: ['friendly', 'playful', 'elegant'], uses: ['consumer', 'campaign'], text: false, display: true, note: 'A casual, lively script for short accents.' },
  'dm-mono': { tones: ['technical', 'friendly'], uses: ['saas'], text: false, display: false, note: 'A monospace in the DM family, with three weights.' },
  'dm-sans': { tones: ['friendly', 'confident'], uses: ['saas', 'consumer', 'campaign'], text: true, display: false, note: 'Low-contrast geometric sans with an optical size axis upstream.' },
  'dm-serif-display': { tones: ['elegant', 'confident'], uses: ['editorial', 'campaign', 'consumer'], text: false, display: true, note: 'High-contrast serif cut for large sizes; one weight.' },
  'eb-garamond': { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'A revival of the Garamond old-style serif.' },
  figtree: { tones: ['friendly', 'confident'], uses: ['saas', 'consumer'], text: true, display: false, note: 'A friendly geometric sans for interfaces and text.' },
  'fira-code': { tones: ['technical', 'playful'], uses: ['saas'], text: false, display: false, note: 'A monospace for code, based on Fira Mono, with programming ligatures.' },
  fraunces: { tones: ['elegant', 'playful', 'friendly'], uses: ['editorial', 'consumer', 'campaign'], text: true, display: true, note: 'A soft, old-style serif with a wide weight range.' },
  'ibm-plex-mono': { tones: ['technical'], uses: ['saas'], text: false, display: false, superfamily: 'ibm-plex', note: 'Monospace member of the IBM Plex family.' },
  'ibm-plex-sans': { tones: ['technical', 'serious'], uses: ['saas', 'corporate'], text: true, display: false, superfamily: 'ibm-plex', note: 'Sans member of the IBM Plex family.' },
  'ibm-plex-serif': { tones: ['technical', 'serious'], uses: ['editorial', 'corporate'], text: true, display: false, superfamily: 'ibm-plex', note: 'Serif member of the IBM Plex family.' },
  inconsolata: { tones: ['technical'], uses: ['saas'], text: false, display: false, note: 'A monospace designed for code listings and terminals.' },
  inter: { tones: ['technical', 'confident', 'serious'], uses: ['saas', 'corporate', 'consumer'], text: true, display: false, note: 'A neutral sans drawn for screens and interfaces.' },
  'jetbrains-mono': { tones: ['technical', 'playful'], uses: ['saas'], text: false, display: false, note: 'Monospace drawn for reading code.' },
  jost: { tones: ['elegant', 'confident'], uses: ['campaign', 'editorial', 'consumer'], text: true, display: true, note: 'A geometric sans in the tradition of Futura-style German sans serifs.' },
  karla: { tones: ['friendly', 'playful'], uses: ['consumer', 'editorial', 'campaign'], text: true, display: false, note: 'A grotesque sans with a few quirky details.' },
  lato: { tones: ['friendly', 'serious'], uses: ['corporate', 'consumer', 'saas'], text: true, display: false, note: 'A sans with semi-rounded details, warm yet stable.' },
  lexend: { tones: ['friendly', 'technical'], uses: ['saas', 'consumer'], text: true, display: false, note: 'A sans family designed to improve reading fluency.' },
  'libre-baskerville': { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'A Baskerville-style serif adapted for body text on screen.' },
  lora: { tones: ['elegant', 'friendly'], uses: ['editorial', 'consumer'], text: true, display: false, note: 'A contemporary serif with calligraphic roots, suited to body text.' },
  manrope: { tones: ['confident', 'friendly', 'technical'], uses: ['saas', 'consumer', 'campaign'], text: true, display: false, note: 'A modern semi-condensed sans with geometric shapes.' },
  merriweather: { tones: ['serious', 'friendly'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A sturdy serif designed for legibility on screens.' },
  montserrat: { tones: ['confident', 'friendly'], uses: ['campaign', 'consumer', 'corporate'], text: true, display: true, note: 'A geometric sans with a wide weight range, popular for headlines.' },
  newsreader: { tones: ['serious', 'elegant'], uses: ['editorial'], text: true, display: false, note: 'A serif designed for on-screen reading of long text.' },
  'noto-serif': { tones: ['serious', 'friendly'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A serif from Google’s Noto family, drawn for broad language support.' },
  'nunito-sans': { tones: ['friendly', 'playful'], uses: ['consumer', 'saas'], text: true, display: false, note: 'A well-balanced sans with softly rounded details.' },
  'open-sans': { tones: ['friendly', 'serious'], uses: ['corporate', 'saas', 'editorial'], text: true, display: false, note: 'A humanist sans designed for legibility in print, on the web and on mobile.' },
  oswald: { tones: ['confident', 'serious'], uses: ['campaign', 'editorial'], text: false, display: true, note: 'A condensed gothic sans for headlines.' },
  outfit: { tones: ['confident', 'friendly'], uses: ['saas', 'consumer', 'campaign'], text: true, display: false, note: 'A geometric sans with a large weight range.' },
  pacifico: { tones: ['playful', 'friendly'], uses: ['consumer', 'campaign'], text: false, display: true, note: 'A brush script with a surf-culture feel; one weight.' },
  'playfair-display': { tones: ['elegant', 'confident'], uses: ['editorial', 'campaign'], text: false, display: true, note: 'A high-contrast transitional serif for titles and large text.' },
  'plus-jakarta-sans': { tones: ['confident', 'friendly'], uses: ['saas', 'consumer', 'corporate'], text: true, display: false, note: 'A modern geometric sans with a wide weight range.' },
  poppins: { tones: ['friendly', 'confident', 'playful'], uses: ['saas', 'consumer', 'campaign'], text: true, display: true, note: 'A geometric sans with a large, even weight range.' },
  'pt-serif': { tones: ['serious', 'friendly'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A transitional serif with humanist features; regular and bold.' },
  'public-sans': { tones: ['serious', 'confident'], uses: ['corporate', 'saas'], text: true, display: false, note: 'A neutral sans developed for public-sector websites.' },
  raleway: { tones: ['elegant', 'confident'], uses: ['campaign', 'editorial', 'consumer'], text: false, display: true, note: 'An elegant sans with a thin-to-black weight range.' },
  rubik: { tones: ['friendly', 'playful'], uses: ['consumer', 'saas', 'campaign'], text: true, display: false, note: 'A sans with slightly rounded corners.' },
  'source-sans-3': { tones: ['serious', 'friendly'], uses: ['corporate', 'editorial', 'saas'], text: true, display: false, note: 'A humanist sans designed for user interfaces.' },
  'source-serif-4': { tones: ['serious', 'elegant'], uses: ['editorial', 'corporate'], text: true, display: false, note: 'A transitional serif with an optical size axis upstream.' },
  'space-grotesk': { tones: ['technical', 'playful', 'confident'], uses: ['saas', 'campaign', 'consumer'], text: false, display: true, note: 'A proportional sans derived from a monospace design.' },
  'space-mono': { tones: ['technical', 'playful'], uses: ['campaign', 'saas'], text: false, display: true, note: 'A monospace with geometric, idiosyncratic forms.' },
  spectral: { tones: ['elegant', 'serious'], uses: ['editorial'], text: true, display: false, note: 'A serif designed for screen-first reading.' },
  syne: { tones: ['playful', 'confident'], uses: ['campaign'], text: false, display: true, note: 'An expressive sans whose heaviest weights are very wide.' },
  'work-sans': { tones: ['friendly', 'serious'], uses: ['corporate', 'editorial', 'saas'], text: true, display: false, note: 'A grotesque-inspired sans tuned for on-screen text.' },
}
