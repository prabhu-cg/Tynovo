import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { Button, inputClass } from '@/modules/shared-ui'
import { computeScale } from '@/modules/typography-system/scale'
import { useProject } from './project'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function OverviewPage() {
  const { draft, editor } = useProject()
  const [trait, setTrait] = useState('')
  const personality = draft.brand.personality

  const addTrait = () => {
    const t = trait.trim()
    if (!t || personality.includes(t) || personality.length >= 12) return
    editor.patch((p) => ({ ...p, brand: { ...p.brand, personality: [...p.brand.personality, t] } }))
    setTrait('')
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTrait()
    }
  }
  const steps = computeScale(draft.typography.scale).length
  const lastExport = draft.exportHistory[0]

  return (
    <div className="grid gap-12">
      <section aria-labelledby="brand-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="brand-h" className="text-lg font-bold">Brand personality</h2>
          <p className="mt-1 text-sm text-ink-soft">Words that should be visible in the type. Up to 12.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <ul className="flex flex-wrap gap-2" aria-label="Personality traits">
            {personality.map((t) => (
              <li key={t} className="flex items-center gap-1 rounded-full border border-line-strong bg-paper py-1 pr-1 pl-3 text-sm font-semibold text-ink-strong">
                {t}
                <button type="button" aria-label={`Remove ${t}`} className="grid size-8 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-sheet-deep hover:text-ink-strong" onClick={() => editor.patch((p) => ({ ...p, brand: { ...p.brand, personality: p.brand.personality.filter((x) => x !== t) } }))}>×</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={trait} onChange={(e) => setTrait(e.target.value)} onKeyDown={onKey} maxLength={40} aria-label="Add a personality trait" placeholder="Add a trait, e.g. precise" className={`${inputClass} min-w-0 flex-1`} />
            <Button onClick={addTrait}>Add</Button>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-ink-strong">
            Notes
            <textarea value={draft.brand.notes} maxLength={5000} rows={4} onChange={(e) => editor.patch((p) => ({ ...p, brand: { ...p.brand, notes: e.target.value } }))} className={`${inputClass} py-2 font-normal`} />
          </label>
        </div>
      </section>

      <section aria-labelledby="sum-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <h2 id="sum-h" className="text-lg font-bold">Where this project stands</h2>
        <dl className="divide-y divide-line border-y border-line">
          <Row to="typography" term="Type scale" value={`${draft.typography.scale.baseSizePx}px base × ${draft.typography.scale.ratio}, ${steps} steps, ${draft.typography.roles.length} roles`} />
          <Row to="typeface" term="Custom typeface" value={draft.customTypeface ? `${draft.customTypeface.familyName} ${draft.customTypeface.styleName}, ${draft.customTypeface.dna.family} family, ${analyzeTypeface(draft.customTypeface).supportedCount} supported glyphs` : 'None yet'} />
          <Row to="export" term="Last export" value={lastExport ? `${lastExport.filename}, ${fmt.format(new Date(lastExport.at))}` : 'Nothing exported yet'} />
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="text-ink-soft">Created</dt><dd className="tnum">{fmt.format(new Date(draft.createdAt))}</dd></div>
        </dl>
      </section>
    </div>
  )
}

function Row({ to, term, value }: { to: string; term: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline">
      <dt className="text-ink-soft">{term}</dt>
      <dd>{value}</dd>
      <dd><Link to={to} className="inline-flex min-h-8 items-center text-sm font-semibold text-accent-strong underline underline-offset-4">Open</Link></dd>
    </div>
  )
}
