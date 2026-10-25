import type { CustomTypeface } from '@/modules/brand-projects/schema'

/** Everything the exporter needs; derived from a CustomTypeface (generated glyphs + overrides applied). */
export interface FontBuildInput {
  typeface: CustomTypeface
  /** ISO timestamp used for head.created/modified so builds are reproducible. */
  timestamp: string
  /** Version string such as "1.000". */
  version: string
}

export interface FontBuildResult {
  bytes: Uint8Array
  filename: string
  mimeType: 'font/ttf'
  format: 'truetype'
}

/** Exporter port. The only implementation today wraps Font Flux JS (GPL-3.0). */
export interface FontBuilder {
  readonly id: string
  build(input: FontBuildInput): Promise<FontBuildResult>
}
