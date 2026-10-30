import { byMode } from './content'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, PrimaryLink, SecondaryLink, StatusBadge, TextLink } from './ui'

function ModeList({ id, title, lead, mode }: { id: string; title: string; lead: string; mode: 'system' | 'typeface' }) {
  return (
    <section aria-labelledby={`${id}-h`} className="border-b border-line">
      <Container className="grid gap-8 py-14 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-14 md:py-20">
        <div>
          <h2 id={`${id}-h`} className="text-3xl font-extrabold">{title}</h2>
          <p className="mt-3 text-lg">{lead}</p>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {byMode(mode).map((c) => (
            <li key={c.id} className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">{c.title}</h3><StatusBadge status={c.status} /></div>
              <p className="mt-1">{c.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function FeaturesPage() {
  return (
    <>
      <Seo page={metaFor('/features')} />
      <PageHeader eyebrow="Features" title="Two modes on one project model." lead="Every capability below carries its status. If it says in development, it is not in the app yet.">
        <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
        <SecondaryLink to="/how-it-works">How it works</SecondaryLink>
      </PageHeader>
      <ModeList id="system" mode="system" title="Brand Typography System" lead="Choose existing fonts, assign them to roles, set a type scale and document the result." />
      <ModeList id="typeface" mode="typeface" title="Custom Typeface Creator" lead="Generate an original display typeface from rules, refine it, validate it and export a real font file." />
      <section aria-labelledby="shared-h">
        <Container className="grid gap-8 py-14 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-14 md:py-20">
          <div>
            <h2 id="shared-h" className="text-3xl font-extrabold">Shared foundations</h2>
            <p className="mt-3 text-lg">What both modes rely on.</p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {byMode('shared').map((c) => (
              <li key={c.id} className="py-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">{c.title}</h3><StatusBadge status={c.status} /></div>
                <p className="mt-1">{c.body}</p>
              </li>
            ))}
            <li className="py-5">
              <h3 className="text-lg font-bold">Principles</h3>
              <p className="mt-1">No account and no database; an AI model is used only if you press the button of an optional suggestion box. An export is either a real file or it does not exist: Tynovo never fakes a font, a quality score or a licence. See <TextLink to="/licensing">licensing</TextLink> and the <TextLink to="/faq">FAQ</TextLink>.</p>
            </li>
          </ul>
        </Container>
      </section>
    </>
  )
}
