import { Link } from 'react-router'
import { countLevels, type ReadinessItem } from '@/modules/brand-system/readiness'
import { AlertIcon, CheckIcon, InfoIcon } from '@/modules/shared-ui'

const WORD = { blocks: 'Blocks', warns: 'Warning', info: 'Note' } as const

/** What to know before exporting: one list for the typography system and the typeface together. */
export function ReadinessList({ items }: { items: readonly ReadinessItem[] }) {
  const c = countLevels(items)
  if (items.length === 0) {
    return <p role="status" className="flex items-center gap-2 text-sm"><span className="text-ok"><CheckIcon /></span>Nothing to fix: every role has a font, the custom typeface suits the roles it is used for, and every preview character is covered.</p>
  }
  return (
    <div className="grid gap-3">
      <p role="status" data-testid="readiness-summary" className="tnum text-sm text-ink-soft">{c.blocks} blocking, {c.warns} warning{c.warns === 1 ? '' : 's'}, {c.info} note{c.info === 1 ? '' : 's'}.</p>
      <ul aria-label="Checks before export" className="divide-y divide-line rounded-md border border-line bg-paper text-sm">
        {items.map((i) => (
          <li key={i.id} data-level={i.level} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
            <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase ${i.level === 'blocks' ? 'text-danger' : i.level === 'warns' ? 'text-warn' : 'text-ink-soft'}`}>{i.level === 'info' ? <InfoIcon /> : <AlertIcon />}{WORD[i.level]}</span>
            <span className="min-w-0 flex-1 basis-72">{i.message}</span>
            {i.area !== 'export' ? <Link to={i.area === 'typeface' ? '../typeface' : '../typography'} className="inline-flex min-h-8 items-center font-semibold text-accent-strong underline underline-offset-4">{i.area === 'typeface' ? 'Open the typeface' : 'Open typography'}</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
