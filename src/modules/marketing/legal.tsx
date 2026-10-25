import type { ReactNode } from 'react'
import { Container, Notice, PageHeader } from './ui'

/** Shared frame for the draft legal pages. The draft notice cannot be omitted. */
export function LegalPage({ eyebrow, title, lead, todo, children }: { eyebrow: string; title: string; lead: string; todo: string[]; children: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      <Container className="py-12 md:py-16">
        <Notice title="Draft: not yet reviewed">
          <p>This text describes how the app behaves today. It has not been reviewed by a lawyer and must be reviewed, completed and approved before any public launch. It does not name an operator, an address or a jurisdiction, because none has been decided.</p>
          <p className="mt-2 font-semibold">To complete before launch:</p>
          <ul className="mt-1 list-disc pl-5">{todo.map((t) => <li key={t}>{t}</li>)}</ul>
        </Notice>
        <div className="mt-10 max-w-2xl [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </Container>
    </>
  )
}
