import { Link } from 'react-router'
import type { ProjectSummary } from '@/modules/brand-projects/schema'
import { TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { ActionMenu, Button, CustomFontIcon, inputClass, LockIcon, type MenuItem } from '@/modules/shared-ui'
import { DeletePanel } from './DeletePanel'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export interface ProjectCardProps {
  summary: ProjectSummary
  /** The built-in sample: opened and copied, never renamed or deleted. */
  sample?: boolean
  /** The new name while renaming, else undefined. */
  renaming?: string | undefined
  confirmingDelete?: boolean
  onRenameStart?: () => void
  onRenameChange?: (name: string) => void
  onRenameSubmit?: () => void
  onRenameCancel?: () => void
  onDuplicate: () => void
  onExport: () => void
  onDeleteStart?: () => void
  onDeleteBackup?: () => Promise<string>
  onDeleteConfirm?: () => void
  onDeleteCancel?: () => void
}

function Stat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{term}</dt>
      <dd className="tnum truncate text-sm font-semibold text-ink-strong">{children}</dd>
    </div>
  )
}

/**
 * A project as a card: its name opens it (the whole card is the target), the key facts are visible at a glance,
 * and every action sits under one "More actions" menu.
 */
export function ProjectCard(p: ProjectCardProps) {
  const s = p.summary
  const href = `/app/projects/${s.id}`
  const chips = [...s.tones.map((t) => TONE_LABEL[t]), ...s.useCases.map((u) => USE_CASE_LABEL[u])]
  const items: MenuItem[] = p.sample
    ? [
        { id: 'open', label: 'Open', to: href, srSuffix: s.name },
        { id: 'duplicate', label: 'Duplicate as my own project', onSelect: p.onDuplicate },
        { id: 'export', label: 'Export project file', onSelect: p.onExport },
      ]
    : [
        { id: 'open', label: 'Open', to: href, srSuffix: s.name },
        { id: 'rename', label: 'Rename', onSelect: () => p.onRenameStart?.() },
        { id: 'duplicate', label: 'Duplicate', onSelect: p.onDuplicate },
        { id: 'export', label: 'Export project file', onSelect: p.onExport },
        { id: 'delete', label: 'Delete…', onSelect: () => p.onDeleteStart?.(), danger: true },
      ]

  return (
    <li data-project={s.name} data-sample={p.sample ? 'true' : undefined} className="relative flex min-w-0 flex-col gap-4 rounded-md border border-line bg-paper p-5 transition-colors focus-within:border-ink hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {p.renaming !== undefined ? (
            <form
              className="relative z-10 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                p.onRenameSubmit?.()
              }}
            >
              <input autoFocus aria-label={`New name for ${s.name}`} value={p.renaming} onChange={(e) => p.onRenameChange?.(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && p.onRenameCancel?.()} maxLength={120} className={`${inputClass} min-w-0 flex-1`} />
              <Button type="submit" variant="primary">Save</Button>
              <Button variant="ghost" onClick={() => p.onRenameCancel?.()}>Cancel</Button>
            </form>
          ) : (
            <h3 className="text-lg leading-snug font-bold break-words text-ink-strong">
              {/* The link stretches over the card, so the whole card opens the project; the menu sits above it. */}
              <Link to={href} className="underline-offset-4 outline-offset-4 after:absolute after:inset-0 after:content-[''] hover:text-accent hover:underline">{s.name}</Link>
            </h3>
          )}
          {s.brandName ? <p className="mt-0.5 text-sm text-ink-soft">Brand: {s.brandName}</p> : null}
        </div>
        <div className="relative z-10 -mt-1.5 -mr-2 shrink-0">
          <ActionMenu label={`More actions for ${s.name}`} items={items} />
        </div>
      </div>

      {p.sample || s.hasCustomTypeface ? (
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {p.sample ? <span data-testid="sample-badge" className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-ink-strong"><LockIcon />Sample, read-only</span> : null}
          {s.hasCustomTypeface ? <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-0.5 text-accent-strong"><CustomFontIcon />Custom typeface</span> : null}
        </div>
      ) : null}

      {s.description ? <p className="line-clamp-3 text-sm text-ink">{s.description}</p> : null}
      {chips.length > 0 ? (
        <ul aria-label="Tone and use" className="flex flex-wrap gap-1.5">
          {chips.slice(0, 4).map((c) => <li key={c} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink">{c}</li>)}
          {chips.length > 4 ? <li className="px-1 py-0.5 text-xs text-ink-soft">+{chips.length - 4} more</li> : null}
        </ul>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        <Stat term="Fonts">{s.fontCount === 0 ? 'None yet' : `${s.fontCount}${s.hasCustomTypeface ? ' incl. your own' : ''}`}</Stat>
        <Stat term="Roles with a font">{s.rolesWithFont} of {s.rolesTotal}</Stat>
        <Stat term="Own typeface">{s.typefaceName ?? 'None'}</Stat>
        <Stat term="Exports">{s.exportCount === 0 ? 'None yet' : `${s.exportCount}${s.lastExportAt ? `, last ${day.format(new Date(s.lastExportAt))}` : ''}`}</Stat>
      </dl>

      {p.confirmingDelete ? (
        <div className="relative z-10 border-t border-line pt-4">
          <DeletePanel name={s.name} onBackup={p.onDeleteBackup!} onConfirm={p.onDeleteConfirm!} onCancel={p.onDeleteCancel!} />
        </div>
      ) : (
        <p className="tnum mt-auto text-xs text-ink-soft">{p.sample ? 'Built into Tynovo. The same for everyone.' : `Edited ${fmt.format(new Date(s.updatedAt))} · Created ${day.format(new Date(s.createdAt))}`}</p>
      )}
    </li>
  )
}
