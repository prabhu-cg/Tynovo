import type { CustomTypeface } from '../brand-projects/schema'
import { defaultDna, type Family } from './dna'
import { ENGINE_VERSION } from './version'

/** Written into new typefaces; the exporter treats it as "no licence chosen" and never writes it into a font. */
export const LICENSE_PLACEHOLDER = 'Not yet chosen by the project owner'

/** A new, empty-override typeface for the given family. The caller supplies the id. */
export function createTypeface(id: string, family: Family = 'geometric', familyName?: string): CustomTypeface {
  return {
    id,
    familyName: familyName ?? `Untitled ${family[0]!.toUpperCase()}${family.slice(1)}`,
    styleName: 'Regular',
    engineVersion: ENGINE_VERSION,
    dna: defaultDna(family),
    overrides: {},
    kerning: [],
    variants: [],
    history: [],
    license: { name: LICENSE_PLACEHOLDER, verified: false },
    copyright: '',
  }
}
