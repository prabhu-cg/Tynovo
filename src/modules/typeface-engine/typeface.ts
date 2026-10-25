import type { CustomTypeface } from '../brand-projects/schema'
import { defaultDna, type Family } from './dna'
import { ENGINE_VERSION } from './version'

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
    license: { name: 'Not yet chosen by the project owner', verified: false },
    copyright: '',
  }
}
