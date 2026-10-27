import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Banner, CloseIcon, Logo, MenuIcon, ScrollToTop } from '@/modules/shared-ui'
import { useCapabilities } from './entitlements'
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
      </ul>
    </nav>
  )
}

function Shell() {
  const { storageWarning, storageKind } = useStudio()
  const caps = useCapabilities()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-paper md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#app-main" className="sr-only z-50 rounded-md bg-ink-strong px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      {/* Left panel: cream, hairline on its right, a 56px header carrying the logo, then the navigation (Doxa's sidebar). */}
      <aside className="hidden border-r border-line bg-sheet md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
          <Link to="/" className="flex min-h-11 items-center"><Logo size="sm" /><span className="sr-only">, go to the website</span></Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3"><Nav /></div>
      </aside>

      {/* Right panel: white, with a sticky 56px top bar that frosts the content scrolling under it. */}
      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-40" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <header className="flex h-14 items-center justify-between gap-4 border-b border-line bg-paper/85 px-4 backdrop-blur-md lg:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((o) => !o)} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-strong transition-colors hover:bg-sheet-deep">{open ? <CloseIcon width={22} height={22} /> : <MenuIcon width={22} height={22} />}</button>
              <Link to="/" className="flex min-h-11 items-center"><Logo size="sm" tagline={false} /><span className="sr-only">, go to the website</span></Link>
            </div>
            <div className="hidden md:block" />
            <p className="hidden text-xs text-ink-soft sm:block">
              Storage: <span className="font-semibold">{storageKind === 'indexeddb' ? 'this browser (IndexedDB)' : 'memory only'}</span>
            </p>
          </header>
          {open ? <div id="app-menu" className="border-b border-line bg-sheet px-4 pb-3 md:hidden"><Nav onNavigate={() => setOpen(false)} /></div> : null}
        </div>

      <main id="app-main" tabIndex={-1} className="min-w-0 bg-paper px-4 py-6 outline-none md:px-10 md:py-10">
        {/* The content column is at most 1440px wide and sits in the middle of the white panel on larger screens. */}
        <div className="mx-auto w-full max-w-[1440px]">
        {storageWarning ? <div className="mb-6"><Banner tone="warn">{storageWarning}</Banner></div> : null}
        {import.meta.env.DEV && caps.grant.preview ? <div className="mb-6"><Banner tone="info"><strong>Development preview of the “{caps.label}” plan.</strong> This is not a purchase and not proof of one: it exists only while Tynovo is being built, and a production build ignores it.</Banner></div> : null}
        <Outlet />
        </div>
      </main>
      </div>
      <ScrollToTop />
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
