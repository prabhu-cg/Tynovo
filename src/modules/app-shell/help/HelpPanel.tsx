import { useCallback } from 'react'
import { Link, useLocation } from 'react-router'
import { Drawer } from '@/modules/shared-ui'
import { useCloseWhenOtherOpens } from '../panels'
import { SCREEN_HELP, screenOf, TOPICS } from './content'

/** Help in a side panel: first what this screen is for and what you can do on it, then the general topics. It stays open as you move around. */
export function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const here = SCREEN_HELP[screenOf(pathname)]
  const close = useCallback(() => onClose(), [onClose])
  useCloseWhenOtherOpens('help', close)
  return (
    <Drawer open={open} title="Help" onClose={onClose}>
      <section aria-labelledby="help-here" data-testid="help-screen">
        <h3 id="help-here" className="text-sm font-bold tracking-wide text-ink-soft uppercase">On this screen</h3>
        <p className="mt-1 text-lg font-bold text-ink-strong">{here.title}</p>
        <p className="mt-1 text-sm text-ink">{here.purpose}</p>
        <ul className="mt-3 grid gap-2 text-sm text-ink">
          {here.can.map((c) => (
            <li key={c} className="relative pl-4 before:absolute before:top-[0.6em] before:left-0 before:size-1 before:rounded-full before:bg-accent">{c}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="help-topics" className="mt-6 border-t border-line pt-4">
        <h3 id="help-topics" className="text-sm font-bold tracking-wide text-ink-soft uppercase">Topics</h3>
        <div className="mt-2 grid gap-2">
          {TOPICS.map((t) => (
            <details key={t.id} data-topic={t.id} className="group rounded-md border border-line bg-paper">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-ink-strong md:min-h-9">
                {t.title}
                <span aria-hidden="true" className="text-accent-text transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <div className="grid gap-2 border-t border-line px-3 py-3 text-sm text-ink">{t.body.map((p) => <p key={p}>{p}</p>)}</div>
            </details>
          ))}
        </div>
      </section>
      <p className="mt-6 text-sm text-ink-soft">
        More: <Link to="/how-it-works" onClick={onClose} className="font-semibold text-accent-strong underline underline-offset-4">how it works</Link>, the <Link to="/faq" onClick={onClose} className="font-semibold text-accent-strong underline underline-offset-4">FAQ</Link> and the <Link to="/privacy" onClick={onClose} className="font-semibold text-accent-strong underline underline-offset-4">privacy notice</Link>. Press <kbd className="rounded-sm border border-line-strong bg-sheet px-1 font-sans text-xs font-semibold">?</kbd> anywhere to open or close this panel.
      </p>
    </Drawer>
  )
}
