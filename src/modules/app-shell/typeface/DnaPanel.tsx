import { CORNER_STYLES, TERMINALS, type Dna } from '@/modules/brand-projects/schema'
import { checkpoint, patchDna, resetDna, switchFamily } from '@/modules/typeface-engine/edit'
import { defaultDna, DNA_CONTROLS, FAMILY_LABELS, type DnaControl, type Family } from '@/modules/typeface-engine/dna'
import { Button, RangeField, Segmented } from '@/modules/shared-ui'
import { COMMERCE, viewOf, type FeatureId } from '@/modules/entitlements'
import { useCapabilities } from '../entitlements'
import { TypefaceBriefAssist } from '../ai/TypefaceBriefAssist'
import { newStamp, type TypefaceHandle } from './useTypeface'

const GROUPS: DnaControl['group'][] = ['Proportions', 'Strokes', 'Construction', 'Corners', 'Spacing']
const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']

const fmt = (c: DnaControl) => (v: number) => (c.step < 1 ? v.toFixed(2) : String(v))

/** All design parameters. Every control edits the shared DNA, so every glyph that uses the idea updates. */
export function DnaPanel({ handle }: { handle: TypefaceHandle }) {
  const { face, edit } = handle
  const caps = useCapabilities()
  const dna = face.dna
  // Only families the plan includes can be switched to. The family a typeface already has is always shown, so nothing a person made is hidden.
  const families = FAMILIES.filter((f) => f === dna.family || viewOf(`typeface.family.${f}` as FeatureId, caps).allowed)
  const lockedFamilies = FAMILIES.filter((f) => !families.includes(f) && viewOf(`typeface.family.${f}` as FeatureId, caps).visible)
  const base = defaultDna(dna.family)
  const set = (patch: Partial<Dna>) => edit((f) => patchDna(f, patch))

  return (
    <div className="grid gap-6" aria-label="Design parameters">
      <TypefaceBriefAssist handle={handle} />
      <Segmented
        label="Family"
        value={dna.family}
        options={families.map((f) => ({ value: f, label: FAMILY_LABELS[f].name.replace(' geometric', '') }))}
        onChange={(f) => edit((t) => switchFamily(t, f, newStamp()))}
      />
      <p className="-mt-3 text-xs text-ink-soft">{FAMILY_LABELS[dna.family].blurb} Switching family loads its defaults, saves a restore point and keeps your glyph overrides.</p>
      {lockedFamilies.length > 0 ? <p data-testid="locked" className="-mt-3 text-xs text-ink-soft">Not included in the {caps.label} plan: {lockedFamilies.map((f) => FAMILY_LABELS[f].name).join(', ')}.{COMMERCE.paymentsAvailable ? '' : ' Paid plans are not available yet.'}</p> : null}

      {GROUPS.map((group) => (
        <details key={group} open={group === 'Proportions' || group === 'Strokes'} className="group rounded-md border border-line bg-paper">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-bold text-ink-strong md:min-h-9">
            {group}
            <span aria-hidden="true" className="text-accent-text transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-4 border-t border-line px-3 py-4">
            {DNA_CONTROLS.filter((c) => c.group === group).map((c) => (
              <RangeField key={c.key} label={c.label} value={dna[c.key]} min={c.min} max={c.max} step={c.step} hint={c.hint} format={fmt(c)} defaultValue={base[c.key]} onChange={(v) => set({ [c.key]: v })} />
            ))}
            {group === 'Corners' ? (
              <>
                <Segmented label="Corner style" value={dna.cornerStyle} options={CORNER_STYLES.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} onChange={(v) => set({ cornerStyle: v })} />
                <Segmented label="Terminals" value={dna.terminal} options={TERMINALS.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} onChange={(v) => set({ terminal: v })} />
              </>
            ) : null}
          </div>
        </details>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handle.update((f) => checkpoint(f, 'Saved by you', newStamp()))}>Save restore point</Button>
        <Button variant="ghost" onClick={() => edit((f) => resetDna(f, newStamp()))}>Reset to {FAMILY_LABELS[dna.family].name} defaults</Button>
      </div>
    </div>
  )
}
