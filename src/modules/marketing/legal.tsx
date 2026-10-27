import type { ReactNode } from 'react'
import { Container, Notice, PageHeader } from './ui'

/** The project's public home, and where questions about these documents go. Real addresses only: nothing here is a placeholder. */
export const PROJECT_URL = 'https://github.com/prabhu-cg/Tynovo'
export const CONTACT_URL = `${PROJECT_URL}/issues`
/** When the legal documents were last changed. Update it whenever one of them changes. */
export const LEGAL_UPDATED = '26 October 2026'

export function External({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-strong underline decoration-1 underline-offset-4 hover:text-accent-text">{children}</a>
}

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

/** Shared frame for the legal documents: a contents list beside numbered, linkable sections. */
export function LegalPage({ title, lead, sections }: { title: string; lead: string; sections: readonly LegalSection[] }) {
  return (
    <>
      <PageHeader title={title} lead={lead} />
      <Container className="grid gap-10 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-14 md:py-16">
        <nav aria-label="On this page" className="md:sticky md:top-6 md:self-start">
          <p className="text-sm font-bold text-ink-strong">On this page</p>
          <ol className="mt-3 grid gap-1 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="inline-flex min-h-8 items-center gap-2 underline-offset-4 hover:text-accent-text hover:underline"><span className="tnum w-5 text-ink-soft">{i + 1}.</span>{s.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 max-w-2xl">
          <p className="tnum text-sm text-ink-soft">Last updated {LEGAL_UPDATED}</p>
          <div className="mt-4">
            <Notice title="Plain language, not legal advice">
              Written by the maintainers of an open-source project, to say clearly what Tynovo does and what you can expect. It has not been reviewed by a lawyer, and it describes the software as it is today.
            </Notice>
          </div>
          <div className="[&_h2]:scroll-mt-6 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10">
                <h2 id={`${s.id}-h`}><span className="tnum mr-2 text-ink-soft">{i + 1}.</span>{s.title}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  )
}
