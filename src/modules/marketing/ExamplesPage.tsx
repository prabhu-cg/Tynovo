import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { defaultDna, FAMILY_LABELS, type Family } from '@/modules/typeface-engine/dna'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { sizeForStep } from '@/modules/typography-system/scale'
import { ExampleFamilies } from './ExampleFamilies'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, Notice, PageHeader, PrimaryLink, Section, TextLink } from './ui'

const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']
const WEIGHTS = [
  { label: 'Light', stroke: 56 },
  { label: 'Regular', stroke: 90 },
  { label: 'Bold', stroke: 140 },
] as const

/** A generated typeface for the given family with optional parameter changes. */
const face = (id: string, family: Family, patch: Partial<ReturnType<typeof defaultDna>> = {}) => {
  const t = createTypeface(id, family)
  return { ...t, dna: { ...t.dna, ...patch } }
}

interface BrandSample {
  kind: string
  note: string
  ratio: number
  display: React.CSSProperties
  body: React.CSSProperties
  caption: React.CSSProperties
  heading: string
  displayText: string
  text: string
  captionText: string
  generatedDisplay?: string
}

const fraunces: React.CSSProperties = { fontFamily: "'Fraunces Variable', serif" }
const manrope: React.CSSProperties = { fontFamily: "'Manrope Variable', sans-serif" }
const plex: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

const BRANDS: BrandSample[] = [
  {
    kind: 'A neighbourhood bakery',
    note: 'A warm serif display over a calm sans for text.',
    ratio: 1.2,
    display: { ...fraunces, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.05 },
    body: { ...manrope, fontWeight: 400, lineHeight: 1.55 },
    caption: { ...manrope, fontWeight: 500, letterSpacing: '0.02em' },
    displayText: 'Fresh at six',
    heading: 'Sourdough, every morning',
    text: 'Loaves come out of the oven before the street wakes up, and are gone by noon.',
    captionText: 'Open Tuesday to Sunday',
  },
  {
    kind: 'An architecture studio',
    note: 'One sans in two weights, with a monospace for details.',
    ratio: 1.25,
    display: { ...manrope, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 },
    body: { ...manrope, fontWeight: 400, lineHeight: 1.6 },
    caption: { ...plex, fontWeight: 400 },
    displayText: 'Spaces, drawn',
    heading: 'Housing at the river bend',
    text: 'A courtyard block that keeps the street edge and opens every flat to two sides.',
    captionText: 'Plan A-02 · 1:200',
  },
  {
    kind: 'A logistics software company',
    note: 'A custom display face for the wordmark and headlines, a sans for everything else.',
    ratio: 1.25,
    display: {},
    body: { ...manrope, fontWeight: 400, lineHeight: 1.55 },
    caption: { ...plex, fontWeight: 600 },
    generatedDisplay: 'TOTAL',
    displayText: 'TOTAL',
    heading: 'Every parcel, one timeline',
    text: 'See where a shipment is, who has touched it and what happens next, without opening five tabs.',
    captionText: 'STATUS: IN TRANSIT',
  },
]

const logistics = face('examples', 'geometric', { strokeThickness: 140 })

function BrandCard({ b }: { b: BrandSample }) {
  const scale = { baseSizePx: 16, ratio: b.ratio, stepsDown: 1, stepsUp: 4 }
  const sizes = { display: sizeForStep(scale, 4), heading: sizeForStep(scale, 2), body: sizeForStep(scale, 0), caption: sizeForStep(scale, -1) }
  return (
    <article className="flex flex-col bg-paper p-6">
      <h3 className="text-lg font-bold">{b.kind}</h3>
      <p className="mt-1 text-sm text-ink-soft">{b.note}</p>
      <div className="mt-6 grow border-t border-line pt-6 text-ink-strong">
        {b.generatedDisplay ? (
          <div style={{ width: `${sizes.display * 4.2}px`, maxWidth: '100%' }}><SpecimenSvg face={logistics} text={b.generatedDisplay} guides={false} label={`${b.generatedDisplay} set in a generated geometric typeface`} /></div>
        ) : (
          <p style={{ ...b.display, fontSize: sizes.display }}>{b.displayText}</p>
        )}
        <p className="mt-5 font-bold" style={{ ...b.body, fontWeight: 700, fontSize: sizes.heading, lineHeight: 1.2 }}>{b.heading}</p>
        <p className="mt-2 text-ink" style={{ ...b.body, fontSize: sizes.body }}>{b.text}</p>
        <p className="mt-3 text-ink-soft" style={{ ...b.caption, fontSize: sizes.caption }}>{b.captionText}</p>
      </div>
      <p className="tnum mt-6 border-t border-line pt-3 text-xs text-ink-soft">Scale 16px × {b.ratio} · display {sizes.display}px · heading {sizes.heading}px · text {sizes.body}px · caption {sizes.caption}px</p>
    </article>
  )
}

export function ExamplesPage() {
  return (
    <>
      <Seo page={metaFor('/examples')} />
      <PageHeader eyebrow="Examples" title="Specimens and illustrative systems." lead="Real type, set live. The brands below are invented to show what a typography system looks like: they are not customers.">
        <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
      </PageHeader>

      <Section id="families" title="Open fonts on this site" intro="Each is licensed under the SIL Open Font License 1.1 and served from this site.">
        <ExampleFamilies />
      </Section>

      <Section id="generated" tone="sheet" title="Three families, one engine" intro="These specimens are drawn by the typeface generator from design parameters: the real outlines the exporter writes to a font file. The same text, set in each family and in three stroke weights.">
        <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3">
          {FAMILIES.map((f) => (
            <figure key={f} className="bg-paper p-5">
              <SpecimenSvg face={face(`fam-${f}`, f)} text="Hamburg" guides={false} label={`${FAMILY_LABELS[f].name} family specimen reading Hamburg`} />
              <figcaption className="mt-3 text-sm text-ink-soft"><span className="font-bold text-ink-strong">{FAMILY_LABELS[f].name}</span><br />{FAMILY_LABELS[f].blurb}</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-px grid gap-px overflow-hidden rounded-md border border-t-0 border-line bg-line md:grid-cols-3">
          {WEIGHTS.map((w) => (
            <figure key={w.label} className="bg-paper p-5">
              <SpecimenSvg face={face(`w-${w.label}`, 'geometric', { strokeThickness: w.stroke })} text="HOTEL" guides={false} label={`Geometric family at ${w.label} stroke weight, reading HOTEL`} />
              <figcaption className="tnum mt-3 text-sm text-ink-soft"><span className="font-bold text-ink-strong">{w.label}</span> · stroke {w.stroke}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6"><TextLink to="/app/lab">Try the generator in the font lab</TextLink></p>
      </Section>

      <Section id="systems" title="Illustrative brand type systems" intro="Three invented brands, each with a display face, a text face and a modular scale.">
        <div className="mb-8"><Notice title="Illustrative only">These are mock-ups made by hand to show the idea. The studio builds a system from your own roles and fonts, but not these layouts or these hand-made fonts: the generator draws display faces from parameters rather than from hand-drawn outlines.</Notice></div>
        <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-3">
          {BRANDS.map((b) => <BrandCard key={b.kind} b={b} />)}
        </div>
      </Section>
      <Container className="pb-16"><p><TextLink to="/features">See what is available and what is not</TextLink></p></Container>
    </>
  )
}
