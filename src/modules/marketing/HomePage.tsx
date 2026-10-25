import { lazy, Suspense } from 'react'
import { FAQS, byMode, type Status } from './content'
import { InteractiveSpecimen } from './InteractiveSpecimen'
import { Seo } from './Seo'
import { PUBLIC_PAGES } from './seo-config'
import { Container, PrimaryLink, SecondaryLink, Section, StatusBadge, TextLink } from './ui'
import { useInView } from './useInView'

const ExampleFamilies = lazy(() => import('./ExampleFamilies').then((m) => ({ default: m.ExampleFamilies })))
const page = PUBLIC_PAGES[0]!

const PROMISES: Array<{ title: string; body: string; status: Status }> = [
  { title: 'Build a complete brand typography system with existing fonts.', body: 'Roles, a modular type scale and licence notes for each font. The scale exists today; choosing fonts is in development.', status: 'planned' },
  { title: 'Create and customise a procedural display font.', body: 'Adjust parameters and every glyph redraws. Three families draw letters, digits and most punctuation today; hand-editing outlines is in development.', status: 'early' },
  { title: 'Preview typography in realistic contexts.', body: 'Check the system on a web page, a poster or a document before committing to it.', status: 'planned' },
  { title: 'Export specifications and supported font files.', body: 'TrueType export of your generated typeface works today. Specifications and tokens are in development.', status: 'early' },
]

const STEPS = [
  ['Start a project', 'Name it and pick where to begin. Nothing to sign up for.', 'available'],
  ['Define the system', 'Set the type scale and roles. Font selection is next.', 'early'],
  ['Shape a typeface', 'Drive the generator with parameters and check the result.', 'early'],
  ['Export', 'Download a project file or a validated font file.', 'available'],
] as const

export function HomePage() {
  const [famRef, famSeen] = useInView<HTMLDivElement>()
  return (
    <>
      <Seo page={page} />
      <section aria-labelledby="hero-h" className="border-b border-line bg-sheet">
        <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="text-sm font-bold text-accent-strong">Free, in your browser, no account</p>
            <h1 id="hero-h" className="mt-3 text-5xl leading-[1.02] font-extrabold md:text-6xl">Build your brand typography. Create your own typeface.</h1>
            <p className="mt-5 max-w-lg text-lg">One studio for the typography system of a brand and for an original display font. It is early software: the page below says plainly what works today and what does not.</p>
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

      <Section id="promise" title="What you will be able to do" intro="Four things, each with its honest status.">
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

      <Section id="modes" tone="sheet" title="Two modes, one project" intro="Both modes edit the same project and share the same type scale, so a typeface you generate can become part of the system.">
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

      <Section id="families" title="Example typography families" intro="Open-licensed fonts that appear on this site, set live, next to an original geometric typeface generated by the studio.">
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
              <span aria-hidden="true" className="tnum text-3xl font-extrabold text-accent">{i + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-1 text-[0.9375rem]">{d}</p>
              <div className="mt-3"><StatusBadge status={s} /></div>
            </li>
          ))}
        </ol>
        <p className="mt-6"><TextLink to="/how-it-works">The workflow in detail</TextLink></p>
      </Section>

      <Section id="pricing" title="Free first">
        <div className="grid gap-8 md:grid-cols-2">
          <p className="text-lg">Everything that exists today is free to use, with no account and no usage limits imposed by a server, because there is no server. No paid plan exists yet and none has been priced.</p>
          <p><TextLink to="/pricing">How pricing is expected to work</TextLink></p>
        </div>
      </Section>

      <Section id="faq" tone="sheet" title="Questions">
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {FAQS.slice(0, 4).map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink-strong">{f.q}<span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-2 max-w-2xl">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6"><TextLink to="/faq">All questions and limitations</TextLink></p>
      </Section>

      <section aria-labelledby="final-h">
        <Container className="py-16 md:py-24">
          <h2 id="final-h" className="max-w-3xl text-4xl leading-[1.05] font-extrabold md:text-5xl">Start with a project.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink to="/app/projects">Open the studio</PrimaryLink>
            <SecondaryLink to="/app/lab">Try the font lab</SecondaryLink>
          </div>
        </Container>
      </section>
    </>
  )
}
