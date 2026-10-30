import { CATALOG_SIZE, type Status } from './content'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, PrimaryLink, SecondaryLink, StatusBadge, TextLink } from './ui'

const STEPS: Array<{ title: string; body: string; status: Status }> = [
  { title: 'Start a project', body: 'Name a project and choose where to begin: the overview, the font catalog, the typography system or the custom typeface. A project is one saved set of data: brand direction, a type scale, roles, fonts and, optionally, a typeface.', status: 'available' },
  { title: 'Describe the brand', body: 'Name the brand, describe it, add personality words, pick use cases and tone, and say how much readability and display use matter. These order the catalog and the font suggestions with fixed rules that show every point and its reason. They are not an AI model.', status: 'early' },
  { title: 'Choose fonts', body: `Search ${CATALOG_SIZE} bundled fonts under the SIL Open Font License 1.1 by name, category, tone and use. Each shows its weights, styles, source and licence. Files load from Tynovo only when a font is previewed or used, and a font that cannot be loaded is reported, never shown as available. You can also name a font installed on your device; Tynovo checks whether it can find it.`, status: 'early' },
  { title: 'Set roles, pairing and scale', body: 'Give display, heading, body, interface and caption roles a font, set a primary and secondary pairing and apply it in one step. Adjust the base size and ratio, heading and body sizes, fluid sizing and fallback stacks. Values that are allowed but unusual are explained in plain words, never silently changed.', status: 'early' },
  { title: 'Shape a typeface', body: 'Pick a construction family and adjust stroke, width, roundness, corners, terminals and spacing; every glyph follows. Edit outline points in the glyph editor, override single glyphs, explore seeded variations, compare them side by side and restore earlier settings. Segments can be curves (quadratic Béziers) with draggable control points, and curves can be fitted to a generated letter’s short straight sides.', status: 'early' },
  { title: 'Bring them together', body: 'Assign your own typeface to the roles whose characters and readability it suits, with measured reasons when it does not. Preview the system as a website, an editorial page, a product screen, a poster and a printed document, on a light or dark surface at phone, tablet or fitted width. Previews and exports read the same project data.', status: 'early' },
  { title: 'Check it', body: 'Before a font is exported Tynovo checks every glyph (finite whole-unit coordinates, no self-intersections, outline direction, counters, vertical metrics) and the kerning references, then checks the produced file again. Glyphs that fail are left out and listed. Errors block the export; warnings and notes are listed. This is a list of findings, not a score.', status: 'available' },
  { title: 'Export', body: 'The export centre builds a specification, CSS, JSON tokens, an HTML specimen, a PDF specimen, a sources and licences file, the project file and one zip of them, all from the saved project and stamped with its revision. Your typeface exports as a checked TrueType (.ttf) or OpenType/CFF (.otf) file. Files of fonts made by others are not included; only the PDF embeds the bundled fonts it draws, as their licence allows in a document.', status: 'early' },
]

export function HowItWorksPage() {
  return (
    <>
      <Seo page={metaFor('/how-it-works')} />
      <PageHeader eyebrow="How it works" title="From a blank project to a brand system and a font file." lead="The workflow, step by step. Each step says whether it is available now or still in development.">
        <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
      </PageHeader>
      <section aria-label="Workflow steps">
        <Container className="py-14 md:py-20">
          <ol className="divide-y divide-line border-y border-line">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid gap-4 py-8 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-8">
                <span aria-hidden="true" className="tnum text-4xl leading-none font-extrabold text-accent-text">{i + 1}</span>
                <div><h2 className="text-2xl font-extrabold">{s.title}</h2><p className="mt-2 max-w-2xl">{s.body}</p></div>
                <div><StatusBadge status={s.status} /></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>
      <section aria-labelledby="sample-h" className="border-t border-line">
        <Container className="py-14 md:py-20">
          <h2 id="sample-h" className="text-3xl font-extrabold">See a finished project first</h2>
          <p className="mt-4 max-w-2xl text-lg">Tynovo includes a read-only sample: an invented coffee brand with a brand direction, two catalog fonts, a typeface drawn in Tynovo, previews and exports. Look through every screen, download what it exports, and duplicate it to get a copy you can edit. Nothing in the sample can be changed or saved.</p>
          <div className="mt-6"><SecondaryLink to="/app/projects/sample-fieldnote">Open the sample project</SecondaryLink></div>
        </Container>
      </section>
      <section aria-labelledby="data-h" className="border-t border-line bg-sheet">
        <Container className="py-14 md:py-20">
          <h2 id="data-h" className="text-3xl font-extrabold">What happens to your work</h2>
          <p className="mt-4 max-w-2xl text-lg">Projects autosave to this browser. Nothing is uploaded; there is no server to upload to. Because storage is local, clearing site data deletes projects, so export a project file for anything you want to keep. Deleting offers a backup first, a project saved by an older version keeps its original when it is upgraded, and a damaged one can be partly recovered into a new project. See the <TextLink to="/faq">FAQ</TextLink> and the <TextLink to="/privacy">privacy notice</TextLink>.</p>
        </Container>
      </section>
    </>
  )
}
