import { Link } from 'react-router'
import type { ProjectSummary } from '@/modules/brand-projects/schema'
import { TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { ActionMenu, ArrowRightIcon, BookIcon, cardClass, CustomFontIcon, LockIcon, type MenuItem } from '@/modules/shared-ui'
import { Stat } from './ProjectCard'

const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/**
 * The built-in sample, shown on top of the projects page as a wide card: what it is, what is in it, and how to use it.
 * It is read-only and lives in code, so it only opens or is copied. The title link stretches over the card (the whole
 * card opens it) and the menu sits above the link.
 */
export function SampleBanner({ summary: s, onDuplicate, onExport }: { summary: ProjectSummary; onDuplicate: () => void; onExport: () => void }) {
  const href = `/app/projects/${s.id}`
  const chips = [...s.tones.map((t) => TONE_LABEL[t]), ...s.useCases.map((u) => USE_CASE_LABEL[u])]
  const items: MenuItem[] = [
    { id: 'open', label: 'Open', to: href, srSuffix: s.name },
    { id: 'duplicate', label: 'Duplicate as my own project', onSelect: onDuplicate },
    { id: 'export', label: 'Export project file', onSelect: onExport },
  ]
  return (
    <li data-project={s.name} data-sample="true" className={`group relative flex min-w-0 flex-col gap-5 sm:p-6 ${cardClass}`}>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent"><BookIcon width={24} height={24} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-lg leading-snug font-bold break-words text-ink-strong">
              <Link to={href} className="underline-offset-4 outline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:text-accent-strong hover:underline">{s.name}</Link>
            </h3>
            <span data-testid="sample-badge" className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-0.5 text-xs font-bold text-accent-strong"><LockIcon />Sample, read-only</span>
            {s.hasCustomTypeface ? <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-bold text-ink-strong"><CustomFontIcon />Custom typeface</span> : null}
          </div>
          {s.brandName ? <p className="mt-0.5 text-sm text-ink-soft">Brand: {s.brandName}</p> : null}
          {s.description ? <p className="mt-2 max-w-3xl text-sm text-ink">{s.description}</p> : null}
        </div>
        <div className="relative z-10 -mt-1.5 -mr-2 flex shrink-0 items-center gap-2 sm:gap-3">
          <span aria-hidden="true" className="hidden items-center gap-1.5 text-sm font-semibold text-accent-strong sm:flex">
            Explore
            <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <ActionMenu label={`More actions for ${s.name}`} items={items} />
        </div>
      </div>

      {chips.length > 0 ? (
        <ul aria-label="Tone and use" className="flex flex-wrap gap-1.5">
          {chips.map((c) => <li key={c} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink">{c}</li>)}
        </ul>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
        <Stat term="Fonts">{s.fontCount === 0 ? 'None yet' : `${s.fontCount}${s.hasCustomTypeface ? ' incl. your own' : ''}`}</Stat>
        <Stat term="Roles with a font">{s.rolesWithFont} of {s.rolesTotal}</Stat>
        <Stat term="Own typeface">{s.typefaceName ?? 'None'}</Stat>
        <Stat term="Exports">{s.exportCount === 0 ? 'None yet' : `${s.exportCount}${s.lastExportAt ? `, last ${day.format(new Date(s.lastExportAt))}` : ''}`}</Stat>
      </dl>
      <p className="text-xs text-ink-soft">Built into Tynovo and the same for everyone. Explore it for reference, or duplicate it to make your own.</p>
    </li>
  )
}
