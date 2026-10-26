import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo, ScrollToTop } from '@/modules/shared-ui'
import { Container, PrimaryLink } from './ui'

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/examples', label: 'Examples' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/faq', label: 'FAQ' },
] as const

const navLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors hover:bg-sheet-deep ${isActive ? 'text-accent-strong underline decoration-2 underline-offset-8' : ''}`

export function MarketingLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a href="#main" className="sr-only z-50 rounded-md bg-ink-strong px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
      <header className="relative border-b border-line bg-paper" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <Container className="flex items-center justify-between gap-4 py-2">
          <Link to="/" className="flex min-h-11 items-center" onClick={() => setOpen(false)}><Logo size="md" /></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={navLink}>{n.label}</NavLink>)}
            <PrimaryLink to="/app/projects" className="ml-2 min-h-9 px-3.5 text-sm">Open Tynovo</PrimaryLink>
          </nav>
          <button
            type="button"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-strong px-3 text-sm font-semibold md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Close menu' : 'Menu'}
          </button>
        </Container>
        {open ? (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-paper px-5 pt-2 pb-4 md:hidden" onClick={() => setOpen(false)}>
            <ul className="grid">
              {NAV.map((n) => <li key={n.to}><NavLink to={n.to} className={navLink}>{n.label}</NavLink></li>)}
            </ul>
            <PrimaryLink to="/app/projects" className="mt-3 w-full">Open Tynovo</PrimaryLink>
          </nav>
        ) : null}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none"><Outlet /></main>
      <ScrollToTop />

      <footer className="border-t border-line bg-sheet">
        <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm">Free software for brand typography and original typefaces. No account. Your projects stay in your browser.</p>
          </div>
          <FooterGroup title="Product" links={[['/features', 'Features'], ['/how-it-works', 'How it works'], ['/examples', 'Examples'], ['/pricing', 'Pricing']]} />
          <FooterGroup title="Open the app" links={[['/app/projects', 'Projects'], ['/app/lab', 'Font lab'], ['/app/settings', 'Settings']]} />
          <FooterGroup title="Information" links={[['/faq', 'FAQ'], ['/licensing', 'Licensing'], ['/privacy', 'Privacy'], ['/terms', 'Terms']]} />
        </Container>
      </footer>
    </div>
  )
}

function FooterGroup({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <nav aria-label={title}>
      <p className="text-sm font-bold text-ink-strong">{title}</p>
      <ul className="mt-3 grid gap-1 text-sm">
        {links.map(([to, label]) => (
          <li key={to}><Link to={to} className="inline-flex min-h-8 items-center underline-offset-4 hover:text-accent hover:underline">{label}</Link></li>
        ))}
      </ul>
    </nav>
  )
}
