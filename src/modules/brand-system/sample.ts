import { createProject, type Clock } from '@/modules/brand-projects/model'
import type { Project } from '@/modules/brand-projects/schema'
import { catalogFontFor } from '@/modules/font-catalog/catalog'
import { checkpoint, patchDna, saveVariant } from '@/modules/typeface-engine/edit'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { exploreVariants } from '@/modules/typeface-engine/variants'
import { addCatalogFont, applyPairing, assignCustomTypeface, setPairing, setResponsive, updateRole } from './ops'

/**
 * The built-in sample project. It is code, not stored data: it cannot be changed, deleted or overwritten, it never
 * appears in a person's own project list or exports, and "Duplicate" turns it into an ordinary project they own.
 * Everything in it is invented, so it shows what a finished project looks like without implying a real client.
 */
export const SAMPLE_PROJECT_ID = 'sample-fieldnote'

const WHEN = '2026-10-01T09:00:00.000Z'

/** A fixed clock: the sample is identical on every load, so tests and screenshots do not drift. */
function fixedClock(): Clock {
  let n = 0
  return { now: () => new Date(WHEN), newId: () => `sample-${++n}` }
}

export function createSampleProject(): Project {
  const clock = fixedClock()
  let p = createProject('Fieldnote sample', clock)
  p = { ...p, id: SAMPLE_PROJECT_ID, createdAt: WHEN, updatedAt: WHEN }

  p = {
    ...p,
    brand: {
      name: 'Fieldnote',
      description: 'Fieldnote roasts coffee in small batches and writes about it plainly: tasting notes, brew guides and the farms behind each bag.',
      personality: ['warm', 'honest', 'curious'],
      useCases: ['consumer', 'editorial', 'campaign'],
      tones: ['friendly', 'elegant'],
      readabilityPriority: 4,
      displayPriority: 4,
      notes:
        'This is a sample project. Fieldnote is invented, and nothing here is saved or can be changed.\nLook around: the brand direction drove the font suggestions, the roles use a pairing of two catalog fonts plus a typeface drawn in Tynovo, and the exports are built from exactly what you see.\nUse “Duplicate” to make a copy that is yours to edit.',
      sampleCopy: {
        headline: 'Slow-roasted, plainly written.',
        subhead: 'Coffee notes from small farms',
        body: 'Every bag carries the story of one farm: the altitude it grows at, the way it is dried and what it tastes like in a cup made at home. No jargon, no hurry, just a good cup of coffee and a few honest words about it.',
        caption: 'Tasting notes - 3 min read',
        action: 'Browse the roasts',
      },
    },
  }

  // Fonts: a pairing from the catalog, as the brand direction suggests (a soft serif with a humanist sans).
  const fraunces = addCatalogFont(p, 'fraunces', clock)!
  const sans = addCatalogFont(fraunces.project, 'source-sans-3', clock)!
  p = setPairing(setPairing(sans.project, 'primary', { kind: 'source', sourceId: fraunces.sourceId }), 'secondary', { kind: 'source', sourceId: sans.sourceId })
  p = applyPairing(p)

  // The scale: a gentler ratio, with fluid sizes so previews change with the width.
  p = { ...p, typography: { ...p.typography, scale: { baseSizePx: 17, ratio: 1.2, stepsDown: 2, stepsUp: 6 } } }
  p = setResponsive(p, { enabled: true, minBaseSizePx: 15, minRatio: 1.125 })
  const [display, heading, body, ui, caption] = p.typography.roles
  p = updateRole(p, heading!.id, { weight: 600 })
  p = updateRole(p, body!.id, { lineHeight: 1.6 })
  p = updateRole(p, ui!.id, { weight: 600 })
  void caption

  // The project's own typeface, drawn in Tynovo, set on the display role (a role that differs from the pairing, on purpose).
  let face = createTypeface('sample-face', 'rounded', 'Fieldnote Rounded')
  face = patchDna(face, { strokeThickness: 96, roundness: 0.92, aperture: 0.34, sidebearing: 64 })
  const stamp = (n: number) => ({ id: `sample-stamp-${n}`, at: WHEN })
  face = checkpoint(face, 'Starting point', stamp(1))
  const [first, second] = exploreVariants(face.dna, 7, 2, 0.25)
  if (first) face = saveVariant(face, { name: 'Softer corners', dna: first.dna, origin: first.origin, favourite: true }, stamp(2))
  if (second) face = saveVariant(face, { name: 'A little wider', dna: second.dna, origin: second.origin }, stamp(3))
  p = { ...p, customTypeface: face }
  p = assignCustomTypeface(p, display!.id)
  p = updateRole(p, display!.id, { weight: 400 }) // the typeface has one weight, so the role asks for it

  // The licences recorded for the catalog fonts come from their packages; check they are what the catalog says.
  for (const s of p.fontSources) if (!catalogFontFor(s.family)) throw new Error(`Sample font ${s.family} is not in the catalog`)
  return p
}
