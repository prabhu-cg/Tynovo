import { useMemo, useState } from 'react'
import type { CustomTypeface, Dna, Variant } from '@/modules/brand-projects/schema'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { applyVariant, deleteVariant, renameVariant, restoreSnapshot, saveVariant, toggleFavourite } from '@/modules/typeface-engine/edit'
import { describeDifference, exploreVariants } from '@/modules/typeface-engine/variants'
import { Button, inputClass, NumberField, RangeField } from '@/modules/shared-ui'
import { COMMERCE } from '@/modules/entitlements'
import { useCapabilities, useFeature } from '../entitlements'
import { newStamp, type TypefaceHandle } from './useTypeface'

const SAMPLE = 'Hamburg'
const COUNT = 6
const MAX_COMPARE = 3
const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface Entry {
  key: string
  title: string
  dna: Dna
  detail: string
  variant?: Variant
}

const withDna = (face: CustomTypeface, dna: Dna): CustomTypeface => ({ ...face, dna })

function Sample({ face, dna, label }: { face: CustomTypeface; dna: Dna; label: string }) {
  return <SpecimenSvg face={withDna(face, dna)} text={SAMPLE} guides={false} label={label} />
}

export function VariantsTab({ handle }: { handle: TypefaceHandle }) {
  const { face, update, edit } = handle
  const caps = useCapabilities()
  const explore = useFeature('typeface.variants.explore')
  const max = caps.limit('typeface.variants.maxSaved')
  const atLimit = face.variants.length >= max
  const canSave = explore.allowed && !atLimit
  const [seed, setSeed] = useState(1)
  const [spread, setSpread] = useState(0.3)
  const [compare, setCompare] = useState<string[]>([])

  // Candidates are derived, not stored: the same base design, seed and spread always give the same six.
  const candidates = useMemo(() => exploreVariants(face.dna, seed, COUNT, spread), [face.dna, seed, spread])
  const saved = useMemo(() => [...face.variants].sort((a, b) => Number(b.favourite) - Number(a.favourite)), [face.variants])

  const toggleCompare = (key: string) => setCompare((c) => (c.includes(key) ? c.filter((k) => k !== key) : c.length < MAX_COMPARE ? [...c, key] : c))

  const entries: Entry[] = [
    ...candidates.map((c) => ({ key: `c${c.origin.index}`, title: `Candidate ${c.origin.index + 1}`, dna: c.dna, detail: `seed ${c.origin.seed}, spread ${c.origin.spread}` })),
    ...saved.map((v) => ({ key: v.id, title: v.name, dna: v.dna, detail: v.origin ? `seed ${v.origin.seed}, spread ${v.origin.spread}, #${v.origin.index + 1}` : 'saved by you', variant: v })),
  ]
  const compared = compare.map((k) => entries.find((e) => e.key === k)).filter((e): e is Entry => !!e)

  const save = (c: (typeof candidates)[number], favourite: boolean) =>
    canSave && update((f) => saveVariant(f, { name: `Seed ${c.origin.seed} · ${c.origin.index + 1}`, dna: c.dna, origin: c.origin, favourite }, newStamp(), max))

  return (
    <div className="grid min-w-0 gap-10">
      {!explore.visible ? null : !explore.allowed ? (
        <section aria-labelledby="explore-h" className="grid gap-2">
          <h2 id="explore-h" className="text-lg font-bold">Explore variations</h2>
          <p data-testid="locked" className="text-sm text-ink-soft">{explore.message} Variants you have already saved stay below, and can still be applied, compared and deleted.</p>
        </section>
      ) : (
      <section aria-labelledby="explore-h" className="grid gap-4">
        <div>
          <h2 id="explore-h" className="text-lg font-bold">Explore variations</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">Six controlled variations of the current design. The same design, seed and spread always give the same six, and each saved variant records the seed and spread that produced it.</p>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <NumberField label="Seed" value={seed} min={0} max={999999} onCommit={setSeed} />
          <Button onClick={() => setSeed((s) => s + 1)}>Next seed</Button>
          <div className="w-56"><RangeField label="Spread" value={spread} min={0.05} max={0.8} step={0.05} format={(v) => v.toFixed(2)} hint="How far each parameter may move" onChange={setSpread} /></div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Candidates">
          <li className="min-w-0 rounded-md border-2 border-accent bg-paper p-3">
            <Sample face={face} dna={face.dna} label="Current design sample" />
            <p className="mt-2 text-sm font-bold text-ink-strong">Current design</p>
          </li>
          {candidates.map((c) => {
            const key = `c${c.origin.index}`
            const diff = describeDifference(face.dna, c.dna)
            return (
              <li key={key} className="flex min-w-0 flex-col rounded-md border border-line bg-paper p-3">
                <Sample face={face} dna={c.dna} label={`Candidate ${c.origin.index + 1} sample`} />
                <p className="mt-2 text-sm font-bold text-ink-strong">Candidate {c.origin.index + 1}</p>
                <p className="tnum min-h-10 grow text-xs text-ink-soft">{diff.length === 0 ? 'Same as the current design.' : diff.slice(0, 3).join(' · ') + (diff.length > 3 ? ` · +${diff.length - 3} more` : '')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button disabled={!canSave} onClick={() => save(c, false)}>Save</Button>
                  <Button disabled={!canSave} onClick={() => save(c, true)} aria-label={`Save candidate ${c.origin.index + 1} as favourite`}>★ Favourite</Button>
                  <label className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold md:min-h-9"><input type="checkbox" className="size-4 accent-accent" checked={compare.includes(key)} onChange={() => toggleCompare(key)} />Compare</label>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      )}

      {compared.length > 0 ? (
        <section aria-labelledby="cmp-h" className="grid gap-3">
          <div className="flex items-center justify-between gap-3"><h2 id="cmp-h" className="text-lg font-bold">Side by side</h2><Button variant="ghost" onClick={() => setCompare([])}>Clear</Button></div>
          <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line" style={{ gridTemplateColumns: `repeat(${compared.length + 1}, minmax(0, 1fr))` }}>
            {[{ key: 'cur', title: 'Current design', dna: face.dna, detail: '' }, ...compared].map((e) => (
              <div key={e.key} className="min-w-0 bg-paper p-3">
                <p className="truncate text-sm font-bold text-ink-strong">{e.title}</p>
                {['Hamburg', 'ABCDEG', '0123'].map((t) => <div key={t} className="mt-2"><SpecimenSvg face={withDna(face, e.dna)} text={t} guides={false} label={`${e.title}: ${t}`} /></div>)}
                <p className="tnum mt-2 text-xs text-ink-soft">{e.key === 'cur' ? 'Baseline' : describeDifference(face.dna, e.dna).join(' · ') || 'No difference'}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="saved-h" className="grid gap-3">
        <h2 id="saved-h" className="text-lg font-bold">Saved variants</h2>
        <p data-testid="variant-count" className="tnum text-sm text-ink-soft">{face.variants.length} of {max} saved.{atLimit && explore.allowed ? ` You are at the limit of the ${caps.label} plan${face.variants.length > max ? ' and over it' : ''}: delete a variant to save another. Nothing you have saved is removed.${COMMERCE.paymentsAvailable ? '' : ' Paid plans are not available yet.'}` : ''}</p>
        {saved.length === 0 ? <p className="text-ink-soft">Nothing saved yet. Save a candidate to keep it.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Saved variants">
            {saved.map((v) => (
              <li key={v.id} className="flex min-w-0 flex-col rounded-md border border-line bg-paper p-3">
                <Sample face={face} dna={v.dna} label={`${v.name} sample`} />
                <label className="mt-2 grid gap-0.5 text-xs text-ink-soft">Name
                  <input defaultValue={v.name} maxLength={60} onBlur={(e) => e.target.value.trim() !== v.name && update((f) => renameVariant(f, v.id, e.target.value))} className={`${inputClass} font-semibold text-ink-strong`} />
                </label>
                <p className="tnum mt-1 text-xs text-ink-soft">{v.origin ? `Seed ${v.origin.seed}, spread ${v.origin.spread}, #${v.origin.index + 1}` : 'Saved by you'} · {when.format(new Date(v.createdAt))}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button aria-pressed={v.favourite} onClick={() => update((f) => toggleFavourite(f, v.id))} aria-label={`${v.favourite ? 'Remove' : 'Mark'} ${v.name} as favourite`}>{v.favourite ? '★ Favourite' : '☆ Favourite'}</Button>
                  <Button variant="primary" onClick={() => edit((f) => applyVariant(f, v.id, newStamp()))}>Apply</Button>
                  <Button variant="ghost" onClick={() => update((f) => deleteVariant(f, v.id))} aria-label={`Delete ${v.name}`}>Delete</Button>
                  <label className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold md:min-h-9"><input type="checkbox" className="size-4 accent-accent" checked={compare.includes(v.id)} onChange={() => toggleCompare(v.id)} />Compare</label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-h" className="grid gap-3">
        <div>
          <h2 id="hist-h" className="text-lg font-bold">Restore points</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">Earlier versions of the design. Restoring one saves the current design as a restore point first, so a restore can be undone.</p>
        </div>
        {face.history.length === 0 ? <p className="text-ink-soft">None yet. One is saved automatically the first time you change the design, whenever you switch family, reset or apply a variant, and when you choose “Save restore point”.</p> : (
          <ul className="divide-y divide-line rounded-md border border-line bg-paper" aria-label="Restore points">
            {face.history.map((h) => {
              const diff = describeDifference(face.dna, h.dna)
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-48 flex-1"><p className="font-semibold text-ink-strong">{h.label}</p><p className="tnum text-xs text-ink-soft">{when.format(new Date(h.at))} · {diff.length === 0 ? 'same as now' : `${diff.length} difference${diff.length > 1 ? 's' : ''} from now`}</p></div>
                  <Button disabled={diff.length === 0} onClick={() => edit((f) => restoreSnapshot(f, h.id, newStamp()))}>Restore</Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
