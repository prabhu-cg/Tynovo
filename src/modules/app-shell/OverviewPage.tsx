import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { workflowSteps } from '@/modules/brand-system/workflow'
import { AlertIcon, Button, CheckIcon, Chip, inputClass, RangeField } from '@/modules/shared-ui'
import { TONES, USE_CASES } from '@/modules/brand-projects/schema'
import { PRIORITY_LABEL, TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { useContentRevision } from './useRevision'
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
  const revision = useContentRevision(editor.saved)
  const steps_ = workflowSteps(draft, revision)

  return (
    <div className="grid gap-12">
      <section aria-labelledby="flow-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="flow-h" className="text-lg font-bold">Brand workflow</h2>
          <p className="mt-1 text-sm text-ink-soft">One project, both modes. Work top to bottom, or jump in anywhere.</p>
        </div>
        <ol aria-label="Brand workflow" className="divide-y divide-line border-y border-line">
          {steps_.map((s, i) => (
            <li key={s.id} data-step={s.id} data-state={s.state} className="grid gap-1 py-3 sm:grid-cols-[2rem_11rem_1fr_auto] sm:items-baseline">
              <span className="tnum text-sm text-ink-soft" aria-hidden="true">{i + 1}</span>
              <span className="font-semibold text-ink-strong">{s.title}</span>
              <span className="min-w-0 text-sm">
                <span className={`mr-2 inline-flex items-center gap-1 text-xs font-bold uppercase ${s.state === 'done' ? 'text-ok' : s.state === 'attention' ? 'text-warn' : 'text-ink-soft'}`}>
                  {s.state === 'done' ? <CheckIcon /> : s.state === 'attention' ? <AlertIcon /> : null}
                  {s.state === 'done' ? 'Done' : s.state === 'attention' ? 'Needs attention' : s.state === 'optional' ? 'Optional' : 'To do'}
                </span>
                {s.detail}
              </span>
              <Link to={s.to} className="inline-flex min-h-8 items-center text-sm font-semibold text-accent-strong underline underline-offset-4">Open<span className="sr-only"> {s.title}</span></Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="brand-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="brand-h" className="text-lg font-bold">Brand direction</h2>
          <p className="mt-1 text-sm text-ink-soft">Who the brand is and what its type must do. The font catalog uses this to order and filter fonts, with fixed rules you can read: it is not an AI model.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <label className="grid max-w-md gap-1 text-sm font-semibold text-ink-strong">
            Brand name
            <input value={draft.brand.name} maxLength={120} placeholder={draft.name} onChange={(e) => editor.patch((p) => ({ ...p, brand: { ...p.brand, name: e.target.value } }))} className={`${inputClass} font-normal`} />
            <span className="text-xs font-normal text-ink-soft">Used in previews and exports. Leave empty to use the project name.</span>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink-strong">
            Description
            <textarea value={draft.brand.description} maxLength={1000} rows={3} onChange={(e) => editor.patch((p) => ({ ...p, brand: { ...p.brand, description: e.target.value } }))} className={`${inputClass} py-2 font-normal`} />
            <span className="text-xs font-normal text-ink-soft">What the brand does and who it speaks to.</span>
          </label>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink-strong">Personality</h3>
            <ul className="flex flex-wrap gap-2 empty:hidden" aria-label="Personality traits">
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
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink-strong">Primary use cases</legend>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map((u) => <Chip key={u} checked={draft.brand.useCases.includes(u)} onChange={() => editor.patch((p) => ({ ...p, brand: { ...p.brand, useCases: p.brand.useCases.includes(u) ? p.brand.useCases.filter((x) => x !== u) : [...p.brand.useCases, u] } }))}>{USE_CASE_LABEL[u]}</Chip>)}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink-strong">Desired tone</legend>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => <Chip key={t} checked={draft.brand.tones.includes(t)} onChange={() => editor.patch((p) => ({ ...p, brand: { ...p.brand, tones: p.brand.tones.includes(t) ? p.brand.tones.filter((x) => x !== t) : [...p.brand.tones, t] } }))}>{TONE_LABEL[t]}</Chip>)}
            </div>
          </fieldset>

          <div className="grid max-w-xl gap-5 sm:grid-cols-2">
            <RangeField label="Readability priority" value={draft.brand.readabilityPriority} min={1} max={5} step={1} format={(v) => PRIORITY_LABEL[v] ?? ''} hint="Long, small text: articles, documentation, forms." onChange={(v) => editor.patch((p) => ({ ...p, brand: { ...p.brand, readabilityPriority: v } }))} />
            <RangeField label="Display-use priority" value={draft.brand.displayPriority} min={1} max={5} step={1} format={(v) => PRIORITY_LABEL[v] ?? ''} hint="Large, expressive text: headlines, posters, hero sections." onChange={(v) => editor.patch((p) => ({ ...p, brand: { ...p.brand, displayPriority: v } }))} />
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
          <Row to="typography" term="Fonts in roles" value={`${draft.typography.roles.filter((r) => r.font?.kind === 'custom').length} with the custom typeface, ${draft.typography.roles.filter((r) => r.font?.kind === 'source').length} with existing fonts`} />
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
