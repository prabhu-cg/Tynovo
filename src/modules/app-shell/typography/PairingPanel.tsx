import { RECOMMENDATION_NOTE, hasBrandSignals, suggestPairings, type PairSuggestion } from '@/modules/font-catalog/recommend'
import { addCatalogFont, applyPairing, pairingDeviations, setPairing } from '@/modules/brand-system/ops'
import type { Project, RoleFont } from '@/modules/brand-projects/schema'
import { Button, inputClass } from '@/modules/shared-ui'
import { Link } from 'react-router'
import { useProject } from '../project'

const encode = (f: RoleFont | null) => (!f ? '' : f.kind === 'custom' ? 'custom' : `source:${f.sourceId}`)

/** Primary (display and headings) and secondary (body and interface) fonts, applied to roles in one step. */
export function PairingPanel() {
  const { draft, editor } = useProject()
  const { pairing } = draft.typography
  const face = draft.customTypeface
  const deviations = pairingDeviations(draft)
  const suggestions = suggestPairings(draft.brand)
  const signals = hasBrandSignals(draft.brand)

  const choose = (slot: 'primary' | 'secondary', v: string) =>
    editor.patch((p) => setPairing(p, slot, v === '' ? null : v === 'custom' ? (p.customTypeface ? { kind: 'custom', typefaceId: p.customTypeface.id } : null) : { kind: 'source', sourceId: v.slice(7) }))

  const adopt = (s: PairSuggestion, apply: boolean) =>
    editor.patch((p) => {
      const a = addCatalogFont(p, s.primary.font.id)
      const b = a && addCatalogFont(a.project, s.secondary.font.id)
      if (!a || !b) return p
      let next: Project = setPairing(setPairing(b.project, 'primary', { kind: 'source', sourceId: a.sourceId }), 'secondary', { kind: 'source', sourceId: b.sourceId })
      if (apply) next = applyPairing(next)
      return next
    })

  const select = (slot: 'primary' | 'secondary', label: string) => (
    <label className="grid gap-1 text-sm font-semibold text-ink-strong">
      {label}
      <select value={encode(pairing[slot])} onChange={(e) => choose(slot, e.target.value)} className={`${inputClass} font-normal`}>
        <option value="">Not chosen</option>
        {face ? <option value="custom">{face.familyName} (your typeface)</option> : null}
        {draft.fontSources.map((s) => <option key={s.id} value={`source:${s.id}`}>{s.family}</option>)}
      </select>
    </label>
  )

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {select('primary', 'Primary font (display and headings)')}
        {select('secondary', 'Secondary font (body, interface and captions)')}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!pairing.primary && !pairing.secondary} onClick={() => editor.patch(applyPairing)}>Apply pairing to roles</Button>
        <p role="status" data-testid="pairing-status" className="text-sm text-ink-soft">
          {!pairing.primary && !pairing.secondary
            ? 'Choose a primary and a secondary font, or pick a suggestion below. You can still change any role on its own afterwards.'
            : deviations.length === 0
              ? 'Every role follows the pairing.'
              : `${deviations.length} role${deviations.length === 1 ? ' differs' : 's differ'} from the pairing: ${deviations.map((r) => r.name).join(', ')}.`}
        </p>
      </div>
      {draft.fontSources.length === 0 && !face ? <p className="text-sm text-ink-soft">No fonts yet. <Link to="../fonts" className="font-semibold text-accent-strong underline underline-offset-4">Browse the font catalog</Link> or add a font by name above.</p> : null}

      <section aria-label="Suggested pairings" className="grid gap-3">
        <h3 className="text-base font-bold">Suggested pairings</h3>
        {!signals ? (
          <p className="text-sm text-ink-soft">Set a tone or a use case in the <Link to=".." className="font-semibold text-accent-strong underline underline-offset-4">brand direction</Link> and Tynovo will suggest pairings from the catalog, with the reason for each point.</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-ink-soft">No pairing scores above zero for this brand direction. Try another tone or use case.</p>
        ) : (
          <ul className="grid gap-3">
            {suggestions.map((s) => (
              <li key={`${s.primary.font.id}+${s.secondary.font.id}`} data-pairing={`${s.primary.font.family} + ${s.secondary.font.family}`} className="grid gap-2 rounded-md border border-line bg-paper p-4">
                <p className="text-base font-bold text-ink-strong">{s.primary.font.family} <span className="font-normal text-ink-soft">with</span> {s.secondary.font.family} <span className="tnum ml-2 text-sm font-semibold text-ink-soft">score {s.score}</span></p>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  {([['Primary', s.primary], ['Secondary', s.secondary]] as const).map(([label, f]) => (
                    <div key={label}>
                      <p className="font-semibold text-ink-strong">{label}: {f.font.family}</p>
                      <ul className="tnum text-ink-soft">{f.reasons.map((r) => <li key={r.text}>{r.points > 0 ? '+' : ''}{r.points} {r.text}</li>)}</ul>
                    </div>
                  ))}
                </div>
                {s.together.length > 0 ? <ul className="tnum text-sm text-ink-soft">{s.together.map((r) => <li key={r.text}>{r.points > 0 ? '+' : ''}{r.points} {r.text}</li>)}</ul> : null}
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Use ${s.primary.font.family} with ${s.secondary.font.family}`} onClick={() => adopt(s, false)}>Use this pairing</Button>
                  <Button aria-label={`Use and apply ${s.primary.font.family} with ${s.secondary.font.family}`} onClick={() => adopt(s, true)}>Use and apply to roles</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="max-w-3xl text-xs text-ink-soft">{RECOMMENDATION_NOTE}</p>
      </section>
    </div>
  )
}
