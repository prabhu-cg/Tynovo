import { digits } from './digits'
import { lower } from './lower'
import { punct } from './punct'
import { upper } from './upper'
import type { SpecTable } from './types'

/** Every glyph recipe, keyed by character. A character absent from this table is reported as missing. */
export const SPECS: SpecTable = { ...upper, ...lower, ...digits, ...punct }
