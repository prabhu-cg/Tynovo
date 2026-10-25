import type { CustomTypeface } from '@/modules/brand-projects/schema'
import type { FontFormat, FontFormatId } from './formats'

/** Everything the exporter needs; derived from a CustomTypeface (generated glyphs + overrides applied). */
export interface FontBuildInput {
  typeface: CustomTypeface
  /** ISO timestamp used for head.created/modified so builds are reproducible. */
  timestamp: string
  /** Version number such as "1.000" (written as "Version 1.000" in the name table). */
  version: string
  /** Defaults to TrueType. */
  format?: FontFormatId
}

export interface FontBuildResult {
  bytes: Uint8Array
  filename: string
  mimeType: FontFormat['mimeType']
  format: FontFormatId
}

/** Exporter port. The only implementation today wraps Font Flux JS (GPL-3.0). */
export interface FontBuilder {
  readonly id: string
  build(input: FontBuildInput): Promise<FontBuildResult>
}
