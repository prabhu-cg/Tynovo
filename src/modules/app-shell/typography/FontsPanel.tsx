import { useState } from 'react'
import { Link } from 'react-router'
import { FALLBACK_STACKS, type FontSource } from '@/modules/brand-projects/schema'
import { CATEGORY_LABEL, catalogFontFor } from '@/modules/font-catalog/catalog'
import { describeAvailability, isDrawable, type Availability } from '@/modules/brand-system/availability'
import { typefaceLimits } from '@/modules/brand-system/fit'
import { rolesUsingCustom } from '@/modules/brand-system/fonts'
import { addNamedFont, removeFontSource, rolesUsingSource, setCustomFallback, setSourceFallback, setSourceLicense } from '@/modules/brand-system/ops'
import { AlertIcon, Banner, Button, ButtonLink, CheckIcon, inputClass } from '@/modules/shared-ui'
import { useProject } from '../project'
import { OriginBadge } from './OriginBadge'
import { StackEditor } from './StackEditor'

const STATE_TEXT = {
  none: '',
  loading: 'Building the font file for previews…',
  ready: 'Registered in your browser for previews',
  failed: 'Could not be registered for previews',
} as const

function AvailabilityLine({ source, a, onRetry }: { source: FontSource; a: Availability | undefined; onRetry: () => void }) {
  if (!a) return null
  const good = isDrawable(a)
  return (
    <p data-testid="font-availability" data-status={a.status} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${good ? 'text-ink' : a.status === 'loading' || a.status === 'unknown' ? 'text-ink-soft' : 'text-warn'}`}>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold">{good ? <span className="text-ok"><CheckIcon /></span> : a.status === 'loading' || a.status === 'unknown' ? null : <AlertIcon />}{good ? (a.status === 'loaded' ? 'Available' : 'Detected') : a.status === 'loading' ? 'Loading' : a.status === 'unknown' ? 'Unchecked' : 'Not available'}</span>
      <span className="min-w-0 flex-1 basis-64">{describeAvailability(a, source)}</span>
      {a.status === 'failed' ? <Button variant="ghost" className="!min-h-8 underline underline-offset-4" onClick={onRetry}>Try again</Button> : null}
    </p>
  )
}

/** Every font the project can use: its own typeface and the existing fonts it has picked up, with licences, stacks and whether they really load. */
export function FontsPanel() {
  const { draft, editor, customFont, fonts } = useProject()
  const face = draft.customTypeface
  const [name, setName] = useState('')
  const [fallback, setFallback] = useState<FontSource['fallback']>('sans-serif')
  const [removing, setRemoving] = useState<string | null>(null)
  const usingCustom = rolesUsingCustom(draft)

  return (
    <div className="grid min-w-0 gap-6">
      <section aria-label="Custom typeface" className="grid gap-3">
        {face ? (
          <div className="grid gap-3 rounded-md border border-line bg-paper p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="text-base font-bold text-ink-strong">{face.familyName}</h3>
              <OriginBadge origin="custom" />
              <span role="status" data-testid="custom-font-status" data-state={customFont.state} data-revision={customFont.revision} className={`text-xs ${customFont.state === 'failed' ? 'font-semibold text-danger' : 'text-ink-soft'}`}>{STATE_TEXT[customFont.state]}</span>
            </div>
            <p className="text-sm">{usingCustom.length > 0 ? <>Used by {usingCustom.map((r) => r.name).join(', ')}.</> : 'Not used by any role yet. Choose it in a role’s font menu below.'}</p>
            {customFont.state === 'failed' ? <Banner tone="error">{customFont.error ?? 'The font could not be built.'} Previews draw this typeface in a fallback font until it can be built again; the project itself is unchanged.</Banner> : null}
            <StackEditor label="Fallback families for your typeface" primary={face.familyName} families={draft.typography.customFallback.families} generic={draft.typography.customFallback.generic} onCommit={(s) => editor.patch((p) => setCustomFallback(p, s))} />
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-ink-strong">What this typeface does not do</summary>
              <ul className="mt-2 grid gap-1 pl-5 [list-style:disc]">{typefaceLimits(face).map((l) => <li key={l}>{l}</li>)}</ul>
            </details>
            <div><ButtonLink to="../typeface" variant="ghost" className="!px-0 underline underline-offset-4">Open in the Custom Typeface Creator</ButtonLink></div>
          </div>
        ) : (
          <Banner tone="info" actions={<ButtonLink to="../typeface">Open the typeface creator</ButtonLink>}>This project has no custom typeface. Design one, and it becomes available in each role’s font menu.</Banner>
        )}
      </section>

      <section aria-label="Existing fonts" className="grid gap-3">
        {draft.fontSources.length === 0 ? (
          <p className="text-sm text-ink-soft">No existing fonts yet. <Link to="../fonts" className="font-semibold text-accent-strong underline underline-offset-4">Browse the font catalog</Link>, pick one from a role’s font menu, or name a font installed on your device below.</p>
        ) : null}
        <ul className="divide-y divide-line rounded-md border border-line bg-paper empty:hidden">
          {draft.fontSources.map((s) => {
            const used = rolesUsingSource(draft, s.id)
            const cat = s.kind === 'catalog' ? catalogFontFor(s.family) : undefined
            return (
              <li key={s.id} data-font-source={s.family} className="grid gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="text-base font-bold text-ink-strong">{s.family}</h3>
                  <OriginBadge origin={s.kind} />
                  <span className="text-xs text-ink-soft">{used.length > 0 ? `Used by ${used.map((r) => r.name).join(', ')}` : 'Not used by any role'}</span>
                </div>
                <AvailabilityLine source={s} a={fonts.availability.get(s.id)} onRetry={() => fonts.retry(s.id)} />
                {cat ? (
                  <p className="text-sm">{CATEGORY_LABEL[cat.category]} · weights {cat.weights.join(', ')}{cat.italic ? ' · italic' : ''} · {s.license.name}{s.license.spdx ? ` (${s.license.spdx})` : ''}. Not included in exports; get it from <code className="text-xs">{cat.distribution}</code>. <Link to={`../fonts`} className="font-semibold text-accent-strong underline underline-offset-4">Details in the catalog</Link></p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="grid gap-1 text-sm font-semibold text-ink-strong">
                      Licence of {s.family}
                      <input value={s.license.name === 'Not recorded' ? '' : s.license.name} maxLength={200} placeholder="e.g. a commercial licence you hold, or SIL OFL 1.1" onChange={(e) => editor.patch((p) => setSourceLicense(p, s.id, { name: e.target.value.trim() === '' ? 'Not recorded' : e.target.value, verified: s.license.verified && e.target.value.trim() !== '' }))} className={`${inputClass} font-normal`} />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-strong md:min-h-9">
                      <input type="checkbox" checked={s.license.verified} disabled={s.license.name === 'Not recorded'} onChange={(e) => editor.patch((p) => setSourceLicense(p, s.id, { ...s.license, verified: e.target.checked }))} className="size-4 accent-accent" />
                      I have checked this licence
                    </label>
                  </div>
                )}
                <StackEditor label={`Fallback families for ${s.family}`} primary={s.family} families={s.fallbackFamilies} generic={s.fallback} onCommit={(st) => editor.patch((p) => setSourceFallback(p, s.id, { fallbackFamilies: st.families, fallback: st.generic }))} />
                {removing === s.id ? (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm removing ${s.family}`}>
                    <span className="text-sm font-semibold text-danger">{used.length > 0 ? `Remove ${s.family}? ${used.map((r) => r.name).join(', ')} will have no font assigned.` : `Remove ${s.family}?`}</span>
                    <Button variant="danger" onClick={() => { editor.patch((p) => removeFontSource(p, s.id)); setRemoving(null) }}>Remove font</Button>
                    <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
                  </div>
                ) : (
                  <div><Button variant="ghost" aria-label={`Remove ${s.family}`} onClick={() => setRemoving(s.id)}>Remove…</Button></div>
                )}
              </li>
            )
          })}
        </ul>

        <form
          aria-label="Add an existing font"
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            let added = false
            editor.patch((p) => {
              const r = addNamedFont(p, name, fallback)
              added = r !== null
              return r ? r.project : p
            })
            if (added || name.trim() === '') setName('')
          }}
        >
          <label className="grid gap-1 text-sm font-semibold text-ink-strong">
            Add an existing font by name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="e.g. Helvetica Neue" className={`${inputClass} font-normal`} />
            <span className="text-xs font-normal text-ink-soft">For a font installed on your device. The studio checks whether it is there and says so; it never claims a font it cannot find.</span>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink-strong">
            Falls back to
            <select value={fallback} onChange={(e) => setFallback(e.target.value as FontSource['fallback'])} className={`${inputClass} font-normal`}>
              {FALLBACK_STACKS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={name.trim() === ''}>Add font</Button>
        </form>
      </section>
    </div>
  )
}
