import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AppSeo } from '@/modules/marketing/Seo'
import { CURRENT_SCHEMA_VERSION } from '@/modules/brand-projects/schema'
import { Banner } from '@/modules/shared-ui'
import { describeError } from './errors'
import { useStudio } from './studio'

export function SettingsPage() {
  const { service, storageKind, storageWarning } = useStudio()
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
        <dt className="text-ink-soft">Licence</dt><dd>GPL-3.0-only. <Link to="/licensing" className="font-semibold text-accent-strong underline underline-offset-4">How licensing works</Link></dd>
        <dt className="text-ink-soft">Policies</dt><dd><Link to="/privacy" className="font-semibold text-accent-strong underline underline-offset-4">Privacy (draft)</Link>, <Link to="/terms" className="font-semibold text-accent-strong underline underline-offset-4">Terms (draft)</Link></dd>
      </dl>
    </div>
  )
}
