import type { Status } from './content'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, PrimaryLink, StatusBadge, TextLink } from './ui'

const STEPS: Array<{ title: string; body: string; status: Status; detail?: string }> = [
  { title: 'Start a project', body: 'Name a project and choose where to begin: the typography system, the custom typeface, or the overview. A project is one file of data: brand notes, a type scale, roles and, optionally, a typeface.', status: 'available' },
  { title: 'Describe the brand', body: 'Add personality traits and notes. They are stored with the project so the decisions that follow have a reason attached.', status: 'available' },
  { title: 'Define the type system', body: 'Set the base size and ratio of the modular scale and see every step set in type. Today the four default roles (display, heading, body, caption) are shown with their computed sizes. Choosing the fonts for them is in development.', status: 'early' },
  { title: 'Shape a typeface', body: 'Pick a construction family and adjust stroke, width, roundness, corners, terminals and spacing; every glyph follows. Override single glyphs, explore seeded variations, compare them side by side and restore earlier settings. Editing outline points by hand is in development.', status: 'early' },
  { title: 'Check it', body: 'Before a font is exported the studio checks every glyph (finite whole-unit coordinates, no self-intersections, outline direction, counters, vertical metrics) and the kerning references, then checks the produced file again. Glyphs that fail are left out and listed. Errors block the export; warnings and notes are listed. This is a list of findings, not a score.', status: 'available' },
  { title: 'Export', body: 'Download the project as a file for backup or to move devices, or export the typeface as a TrueType (.ttf) file. Each font export is recorded in the project with its size and a SHA-256 checksum. Specification documents and CSS/JSON tokens are in development.', status: 'available' },
]

export function HowItWorksPage() {
  return (
    <>
      <Seo page={metaFor('/how-it-works')} />
      <PageHeader eyebrow="How it works" title="From a blank project to a font file." lead="The workflow, step by step. Each step says whether it is available now or still in development.">
        <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
      </PageHeader>
      <section aria-label="Workflow steps">
        <Container className="py-14 md:py-20">
          <ol className="divide-y divide-line border-y border-line">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid gap-4 py-8 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-8">
                <span aria-hidden="true" className="tnum text-4xl leading-none font-extrabold text-accent">{i + 1}</span>
                <div><h2 className="text-2xl font-extrabold">{s.title}</h2><p className="mt-2 max-w-2xl">{s.body}</p></div>
                <div><StatusBadge status={s.status} /></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>
      <section aria-labelledby="data-h" className="border-t border-line bg-sheet">
        <Container className="py-14 md:py-20">
          <h2 id="data-h" className="text-3xl font-extrabold">What happens to your work</h2>
          <p className="mt-4 max-w-2xl text-lg">Projects autosave to this browser. Nothing is uploaded; there is no server to upload to. Because storage is local, clearing site data deletes projects, so export a project file for anything you want to keep. See the <TextLink to="/faq">FAQ</TextLink> and the draft <TextLink to="/privacy">privacy notice</TextLink>.</p>
        </Container>
      </section>
    </>
  )
}
