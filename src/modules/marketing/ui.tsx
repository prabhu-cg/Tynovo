import { Link, type LinkProps } from 'react-router'
import type { ReactNode } from 'react'
import { STATUS_LABEL, type Status } from './content'

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 md:px-8 ${className}`}>{children}</div>
}

/** Status marker: never colour alone, always text. */
export function StatusBadge({ status }: { status: Status }) {
  const style =
    status === 'available'
      ? 'border-accent bg-accent-wash text-accent-strong'
      : status === 'early'
        ? 'border-line-strong bg-paper text-ink-strong'
        : 'border-line bg-sheet text-ink-soft'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${style}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${status === 'available' ? 'bg-accent' : status === 'early' ? 'bg-ink' : 'bg-line-strong'}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

const cta = 'inline-flex min-h-11 items-center justify-center rounded-md px-5 text-[0.9375rem] font-semibold transition-colors duration-150'

export function PrimaryLink(props: LinkProps) {
  const { className = '', ...rest } = props
  return <Link {...rest} className={`${cta} bg-accent text-white hover:bg-accent-strong ${className}`} />
}

export function SecondaryLink(props: LinkProps) {
  const { className = '', ...rest } = props
  return <Link {...rest} className={`${cta} border border-line-strong bg-paper text-ink-strong hover:border-ink ${className}`} />
}

export function TextLink(props: LinkProps) {
  const { className = '', ...rest } = props
  return <Link {...rest} className={`font-semibold text-accent-strong underline decoration-1 underline-offset-4 hover:text-accent ${className}`} />
}

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="border-b border-line bg-sheet">
      <Container className="py-14 md:py-20">
        {eyebrow ? <p className="text-sm font-bold text-accent-strong">{eyebrow}</p> : null}
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-extrabold md:text-6xl">{title}</h1>
        {lead ? <p className="mt-5 max-w-2xl text-lg">{lead}</p> : null}
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
      </Container>
    </header>
  )
}

export function Section({ id, title, intro, children, tone = 'plain' }: { id?: string; title: string; intro?: ReactNode; children: ReactNode; tone?: 'plain' | 'sheet' }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={tone === 'sheet' ? 'border-y border-line bg-sheet' : ''}>
      <Container className="py-14 md:py-20">
        <h2 id={id ? `${id}-h` : undefined} className="max-w-2xl text-3xl font-extrabold md:text-4xl">{title}</h2>
        {intro ? <p className="mt-4 max-w-2xl text-lg">{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  )
}

/** Notice for draft or illustrative content. Uses role=note so it is announced but not an alert. */
export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside role="note" className="rounded-md border border-[#e0c27a] bg-[#fdf6e3] px-5 py-4 text-[#5c3d00]">
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-[0.9375rem]">{children}</div>
    </aside>
  )
}
