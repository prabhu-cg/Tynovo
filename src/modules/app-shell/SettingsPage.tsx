import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AppSeo } from '@/modules/marketing/Seo'
import { CURRENT_SCHEMA_VERSION } from '@/modules/brand-projects/schema'
import { FEATURES } from '@/modules/entitlements'
import { Banner } from '@/modules/shared-ui'
import { useCapabilities } from './entitlements'
import { describeError } from './errors'
import { useStudio } from './studio'

export function SettingsPage() {
  const { service, storageKind, storageWarning } = useStudio()
  const caps = useCapabilities()
  const shipped = FEATURES.filter((f) => f.implemented && !f.essential)
  const [count, setCount] = useState<{ projects: number; unreadable: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    service.list().then((l) => setCount({ projects: l.projects.length, unreadable: l.unreadable.length }), (e: unknown) => setError(describeError(e)))
  }, [service])
  return (
    <div className="mx-auto max-w-3xl">
      <AppSeo title="Settings" />
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <p className="mt-1 text-ink-soft">There is nothing to configure yet. This page shows where your data lives.</p>
      {storageWarning ? <div className="mt-6"><Banner tone="warn">{storageWarning}</Banner></div> : null}
      {error ? <div className="mt-6"><Banner tone="error">{error}</Banner></div> : null}
      <dl className="tnum mt-8 grid gap-x-6 gap-y-3 border-t border-line pt-6 sm:grid-cols-[12rem_1fr]">
        <dt className="text-ink-soft">Storage</dt><dd>{storageKind === 'indexeddb' ? 'This browser (IndexedDB). Cleared if you clear site data.' : 'Memory only. Nothing survives closing the tab.'}</dd>
        <dt className="text-ink-soft">Projects</dt><dd>{count ? `${count.projects}${count.unreadable ? `, plus ${count.unreadable} unreadable` : ''}` : '…'}</dd>
        <dt className="text-ink-soft">Project schema</dt><dd>Version {CURRENT_SCHEMA_VERSION}</dd>
        <dt className="text-ink-soft">Account</dt><dd>None. There is no sign-in and no server.</dd>
        <dt className="text-ink-soft">Plan</dt><dd data-testid="plan">{caps.label}. {caps.allows('export.package') ? 'Everything in this version of the studio is included.' : 'Some features are not included; they are listed below.'} There is no payment system in the studio: nothing here can be bought, and no plan can be switched on from this page.</dd>
        <dt className="text-ink-soft">Always free</dt><dd>Keeping, exporting, importing, upgrading and recovering your own projects. No plan can restrict these.</dd>
        <dt className="text-ink-soft">Licence</dt><dd>GPL-3.0-only. <Link to="/licensing" className="font-semibold text-accent-strong underline underline-offset-4">How licensing works</Link></dd>
        <dt className="text-ink-soft">Policies</dt><dd><Link to="/privacy" className="font-semibold text-accent-strong underline underline-offset-4">Privacy (draft)</Link>, <Link to="/terms" className="font-semibold text-accent-strong underline underline-offset-4">Terms (draft)</Link></dd>
      </dl>

      <details className="mt-8 border-t border-line pt-6">
        <summary className="cursor-pointer font-semibold text-ink-strong">What the {caps.label} plan covers</summary>
        <ul aria-label="Features" className="mt-3 divide-y divide-line rounded-md border border-line bg-paper text-sm">
          {shipped.map((f) => {
            const d = caps.decide(f.id)
            return (
              <li key={f.id} data-feature={f.id} data-allowed={d.allowed} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 basis-64"><span className="font-semibold text-ink-strong">{f.title}</span><span className="block text-xs text-ink-soft">{f.description}</span></span>
                <span className="tnum font-semibold">{f.kind === 'limit' ? `Up to ${caps.limit(f.id)}` : d.allowed ? 'Included' : 'Not included'}</span>
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}
