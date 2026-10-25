import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Banner } from '@/modules/shared-ui'
import { StudioProvider } from './StudioContext'
import { useStudio } from './studio'

const NAV = [
  { to: '/app/projects', label: 'Projects' },
  { to: '/app/lab', label: 'Font lab' },
  { to: '/app/settings', label: 'Settings' },
] as const

const link = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors md:min-h-9 ${isActive ? 'bg-accent-wash text-accent-strong' : 'text-ink hover:bg-sheet-deep'}`

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Application" onClick={onNavigate}>
      <ul className="grid gap-1">
        {NAV.map((n) => <li key={n.to}><NavLink to={n.to} className={link}>{n.label}</NavLink></li>)}
        <li><NavLink to="/" end className={link}>Website</NavLink></li>
      </ul>
    </nav>
  )
}

function Shell() {
  const { storageWarning, storageKind } = useStudio()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-sheet md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <a href="#app-main" className="sr-only z-50 rounded-md bg-ink-strong px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      {/* Mobile bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2 md:hidden" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <Link to="/app/projects" className="flex min-h-11 items-center text-sm font-extrabold tracking-tight text-ink-strong">Brand Typography Studio</Link>
        <button type="button" aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((o) => !o)} className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-strong px-3 text-sm font-semibold">{open ? 'Close menu' : 'Menu'}</button>
      </header>
      {open ? <div id="app-menu" className="border-b border-line bg-paper px-4 pb-3 md:hidden"><Nav onNavigate={() => setOpen(false)} /></div> : null}

      {/* Desktop sidebar */}
      <aside className="hidden flex-col gap-6 border-r border-line bg-paper px-4 py-6 md:flex md:min-h-dvh">
        <Link to="/app/projects" className="px-3 text-sm font-extrabold tracking-tight text-ink-strong">Brand Typography<br />Studio</Link>
        <Nav />
        <p className="mt-auto px-3 text-xs text-ink-soft">
          Storage: <span className="font-semibold">{storageKind === 'indexeddb' ? 'this browser (IndexedDB)' : 'memory only'}</span>
        </p>
      </aside>

      <main id="app-main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none md:px-10 md:py-10">
        {storageWarning ? <div className="mb-6"><Banner tone="warn">{storageWarning}</Banner></div> : null}
        <Outlet />
      </main>
    </div>
  )
}

export function AppLayout() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  )
}
