import { FAQS } from './content'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, TextLink } from './ui'

const GROUPS = ['Using it', 'Fonts and licensing', 'Limitations'] as const

export function FaqPage() {
  return (
    <>
      <Seo page={metaFor('/faq')} />
      <PageHeader eyebrow="FAQ" title="Questions and limits." lead="Including the things Tynovo cannot do yet." />
      <Container className="py-14 md:py-20">
        {GROUPS.map((g) => (
          <section key={g} aria-labelledby={`g-${g.replace(/\s/g, '')}`} className="mx-auto mb-12 grid max-w-3xl gap-4">
            <h2 id={`g-${g.replace(/\s/g, '')}`} className="text-2xl font-extrabold">{g}</h2>
            <div className="divide-y divide-line border-y border-line">
              {FAQS.filter((f) => f.group === g).map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-ink-strong">{f.q}<span aria-hidden="true" className="text-accent-text transition-transform group-open:rotate-45">+</span></summary>
                  <p className="mt-2 max-w-2xl">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <p className="mx-auto max-w-3xl">More on fonts and licences: <TextLink to="/licensing">licensing</TextLink>.</p>
      </Container>
    </>
  )
}
