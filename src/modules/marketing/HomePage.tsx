import { lazy, Suspense } from 'react'
import { CATALOG_SIZE, FAQS, byMode, type Status } from './content'
import { InteractiveSpecimen } from './InteractiveSpecimen'
import { LaptopShowcase } from './LaptopShowcase'
import { Seo } from './Seo'
import { PUBLIC_PAGES } from './seo-config'
import { Container, PrimaryLink, SecondaryLink, Section, StatusBadge, TextLink } from './ui'
import { useInView } from './useInView'

const ExampleFamilies = lazy(() => import('./ExampleFamilies').then((m) => ({ default: m.ExampleFamilies })))
const page = PUBLIC_PAGES[0]!

const PROMISES: Array<{ title: string; body: string; status: Status }> = [
  { title: 'Build a brand typography system from licensed fonts.', body: `Describe the brand, browse ${CATALOG_SIZE} licensed fonts with their sources, set roles and a pairing, and tune a fluid type scale. A licence note is kept for every font. The catalog is small and fixed; a font you name is checked, never assumed.`, status: 'early' },
  { title: 'Create and refine an original typeface.', body: 'Pick a construction family and adjust its parameters, and every glyph redraws. Edit outline points in the glyph editor, explore seeded variations and run quality checks. Three families draw the 95 printable ASCII characters (Latin script only); the glyph editor works with points and quadratic curves.', status: 'available' },
  { title: 'Use your typeface inside the system.', body: 'Assign your generated typeface to display, heading, body or interface roles when its characters and readability suit them. When they do not, you are told why, with the numbers.', status: 'available' },
  { title: 'Preview, check and export.', body: 'See the system on a website, an editorial page, a product screen, a poster and a printed page, light or dark. Export a specification, CSS, tokens, an HTML and a PDF specimen, a licence manifest and real TrueType, OpenType, WOFF or WOFF2 files.', status: 'available' },
]

const STEPS = [
  ['Start a project', 'Name it and pick where to begin. Nothing to sign up for.', 'available'],
  ['Define the brand and system', 'Describe the brand, choose fonts, assign roles and tune the scale.', 'early'],
  ['Shape a typeface', 'Optional. Drive the generator, edit glyphs and check the result.', 'available'],
  ['Preview and export', 'See it in real layouts, then export files built from the saved project.', 'available'],
] as const

export function HomePage() {
  const [famRef, famSeen] = useInView<HTMLDivElement>()
  return (
    <>
      <Seo page={page} />
      <section aria-labelledby="hero-h" className="hero-field border-b border-line">
        <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="text-sm font-bold text-accent-strong">Free, in your browser, no account</p>
            <h1 id="hero-h" className="mt-3 text-5xl leading-[1.02] font-extrabold md:text-6xl">Build your brand typography. Create your own typeface.</h1>
            <p className="mt-5 max-w-lg text-lg">Tynovo is one studio for the typography system of a brand and for an original display font. It is early software: this page says plainly what works today and what does not.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
              <SecondaryLink to="/features">See what works today</SecondaryLink>
            </div>
          </div>
          <div className="min-w-0">
            <InteractiveSpecimen />
          </div>
        </Container>
      </section>

      <Section id="screens" tone="sheet" title="See it working" intro="Real screens from Tynovo’s read-only sample project, not mock-ups. Pick a screen to look at." centered>
        <LaptopShowcase />
        <p className="mt-8 flex justify-center"><SecondaryLink to="/app/projects/sample-fieldnote">Open the sample project</SecondaryLink></p>
      </Section>

      <Section id="promise" title="What you can do today" intro="Four things, each with its honest status.">
        <ol className="divide-y divide-line border-y border-line">
          {PROMISES.map((p, i) => (
            <li key={p.title} className="grid gap-3 py-6 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-baseline md:gap-6">
              <span aria-hidden="true" className="tnum text-sm font-bold text-ink-soft">0{i + 1}</span>
              <div><h3 className="text-xl font-bold">{p.title}</h3><p className="mt-1 max-w-2xl">{p.body}</p></div>
              <div><StatusBadge status={p.status} /></div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="modes" tone="sheet" title="Two modes, one project" intro="Both modes edit the same saved project. Assign a typeface you generate to a role in the system, and the previews and exports use it.">
        <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2">
          {([['system', 'Brand Typography System', 'Decide which fonts a brand uses, for what, and at which sizes.'], ['typeface', 'Custom Typeface Creator', 'Generate an original display typeface from rules, check it, and export a real font file.']] as const).map(([mode, title, lead]) => (
            <div key={mode} className="bg-paper p-6 md:p-8">
              <h3 className="text-2xl font-extrabold">{title}</h3>
              <p className="mt-2">{lead}</p>
              <ul className="mt-6 grid gap-3">
                {byMode(mode).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3 border-t border-line pt-3"><span className="font-semibold text-ink-strong">{c.title}</span><StatusBadge status={c.status} /></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6"><TextLink to="/features">Full feature list</TextLink></p>
      </Section>

      <Section id="families" title="Example typography families" intro="Open-licensed fonts that appear on this site, set live, next to an original geometric typeface generated by Tynovo.">
        <div ref={famRef} className="min-h-48">
          {famSeen ? (
            <Suspense fallback={<p className="text-ink-soft" role="status">Loading specimens…</p>}><ExampleFamilies /></Suspense>
          ) : null}
        </div>
        <p className="mt-6"><TextLink to="/examples">More examples</TextLink></p>
      </Section>

      <Section id="workflow" tone="sheet" title="How a project goes">
        <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-4">
          {STEPS.map(([t, d, s], i) => (
            <li key={t} className="bg-paper p-5">
              <span aria-hidden="true" className="tnum text-3xl font-extrabold text-accent-text">{i + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-1 text-[0.9375rem]">{d}</p>
              <div className="mt-3"><StatusBadge status={s} /></div>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2"><TextLink to="/how-it-works">The workflow in detail</TextLink><TextLink to="/app/projects/sample-fieldnote">Open the read-only sample project</TextLink></p>
      </Section>

      <Section id="pricing" title="Free first">
        <div className="grid gap-8 md:grid-cols-2">
          <p className="text-lg">Everything that exists today is free to use, with no account and no payment system. What a plan includes is configuration in the code, and none has been priced or switched on. Exporting, importing and recovering your own projects are protected from any plan restriction.</p>
          <p><TextLink to="/pricing">How pricing is expected to work</TextLink></p>
        </div>
      </Section>

      <Section id="faq" tone="sheet" title="Questions" centered>
        <div className="mx-auto max-w-3xl divide-y divide-line border-y border-line">
          {FAQS.slice(0, 4).map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink-strong">{f.q}<span aria-hidden="true" className="text-accent-text transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-2 max-w-2xl">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl"><TextLink to="/faq">All questions and limitations</TextLink></p>
      </Section>
    </>
  )
}
