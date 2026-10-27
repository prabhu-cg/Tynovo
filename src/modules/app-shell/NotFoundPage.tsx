import { useLocation } from 'react-router'
import { LogoMark } from '@/modules/shared-ui/Logo'
import { Seo } from '@/modules/marketing/Seo'
import { PrimaryLink, SecondaryLink } from '@/modules/marketing/ui'

/** Longest address echoed back; a long or hostile path is cut, and it is only ever rendered as text. */
const MAX_SHOWN = 80

const drift = 'motion-safe:animate-[drift_3.4s_ease-in-out_infinite_alternate]'

export function NotFoundPage() {
  const { pathname } = useLocation()
  const shown = pathname.length > MAX_SHOWN ? `${pathname.slice(0, MAX_SHOWN)}…` : pathname
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6 py-12">
      <Seo page={{ path: '/404', title: 'Page not found', description: 'This page does not exist.', indexable: false }} />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_38%,color-mix(in_srgb,var(--color-accent-wash)_45%,white)_0%,white_70%)]"
      />
      <div className="relative flex max-w-[30rem] flex-col items-center text-center">
        <span className="mb-7 inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-3 py-1 text-[0.6875rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-strong" />
          Error 404
        </span>

        {/* The numeral: two 4s with the Tynovo mark standing in for the 0. Decorative; the heading carries the message. */}
        <div aria-hidden="true" className="mb-5 flex items-center justify-center gap-1">
          <span className="text-[8rem] leading-none font-extrabold tracking-[-0.04em] text-ink-strong select-none">4</span>
          <span className="relative -mx-1 flex size-26 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-line-strong" />
            <span className={`absolute top-1.5 -right-1 size-2 rounded-full bg-accent opacity-55 ${drift} [animation-delay:0.3s]`} />
            <span className={`absolute bottom-2.5 -left-1.5 size-1.5 rounded-full bg-ink opacity-55 ${drift} [animation-delay:0.6s]`} />
            <LogoMark height={58} className={`drop-shadow-[0_10px_14px_rgba(38,38,38,0.14)] ${drift}`} />
          </span>
          <span className="text-[8rem] leading-none font-extrabold tracking-[-0.04em] text-ink-strong select-none">4</span>
        </div>

        <h1 className="mb-2 text-[1.375rem] font-bold tracking-[-0.01em] text-ink-strong">This page didn’t make the cut.</h1>
        <p className="mb-8 max-w-[26rem] text-[0.9375rem] leading-relaxed text-ink-soft">It’s broken, moved, or never existed. Tynovo can’t set a page that isn’t there.</p>

        <div className="flex flex-wrap justify-center gap-2.5">
          <PrimaryLink to="/app/projects">Open your projects</PrimaryLink>
          <SecondaryLink to="/">Back to the home page</SecondaryLink>
        </div>

        <p className="mt-9 text-xs text-ink-soft">
          Looking for <code className="rounded bg-accent-wash px-1.5 py-0.5 font-mono break-all text-accent-strong">{shown}</code>? It’s not in this studio.
        </p>
      </div>
    </main>
  )
}
