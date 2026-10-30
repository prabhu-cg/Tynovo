import { suggestTypeface } from '@/modules/ai/client'
import type { TypefaceSuggestion } from '@/modules/ai/schemas'
import type { CustomTypeface, Dna } from '@/modules/brand-projects/schema'
import { lockedMessage } from '@/modules/entitlements'
import { DNA_CONTROLS, FAMILY_LABELS } from '@/modules/typeface-engine/dna'
import { checkpoint, patchDna, switchFamily, type Stamp } from '@/modules/typeface-engine/edit'
import { Button } from '@/modules/shared-ui'
import { useCapabilities } from '../entitlements'
import { newStamp, type TypefaceHandle } from '../typeface/useTypeface'
import { BriefBox } from './BriefBox'
import { useAssist } from './useAssist'

interface Change { label: string; from: string; to: string }

/** The typeface after a suggestion is applied: a family switch loads that family's defaults first, then the suggested settings go on top. */
function applySuggestion(f: CustomTypeface, s: TypefaceSuggestion, stamp: Stamp): CustomTypeface {
  const t = s.family && s.family !== f.dna.family ? switchFamily(f, s.family, stamp) : f
  const patch: Partial<Dna> = { ...s.values, ...(s.cornerStyle ? { cornerStyle: s.cornerStyle } : {}), ...(s.terminal ? { terminal: s.terminal } : {}) }
  return patchDna(t, patch)
}

/** Everything that would differ, including the settings a family switch resets, so nothing changes without being listed. */
function changesFor(face: CustomTypeface, s: TypefaceSuggestion): Change[] {
  const before = face.dna
  const after = applySuggestion(face, s, { id: 'preview', at: '1970-01-01T00:00:00.000Z' }).dna
  const out: Change[] = []
  if (after.family !== before.family) out.push({ label: 'Family', from: FAMILY_LABELS[before.family].name, to: FAMILY_LABELS[after.family].name })
  if (after.cornerStyle !== before.cornerStyle) out.push({ label: 'Corner style', from: before.cornerStyle, to: after.cornerStyle })
  if (after.terminal !== before.terminal) out.push({ label: 'Terminals', from: before.terminal, to: after.terminal })
  for (const c of DNA_CONTROLS) if (after[c.key] !== before[c.key]) out.push({ label: c.label, from: String(before[c.key]), to: String(after[c.key]) })
  return out
}

/** Describe the typeface in words; get design settings to accept or ignore. A restore point is saved before they are applied. */
export function TypefaceBriefAssist({ handle }: { handle: TypefaceHandle }) {
  const caps = useCapabilities()
  const allowed = caps.allows('ai.assist')
  const { state, ask, clear } = useAssist(suggestTypeface)

  const apply = (s: TypefaceSuggestion) => {
    handle.update((f) => checkpoint(f, 'Before AI suggestion', newStamp()))
    handle.edit((f) => applySuggestion(f, s, newStamp()))
    clear()
  }

  return (
    <BriefBox
      id="typeface"
      title="Describe the typeface you want"
      label="What should it feel like, and where will it be used?"
      placeholder="A warm, slightly rounded display face for a bakery's window and menus: friendly, a little chunky, not childish."
      button="Suggest settings"
      state={state}
      onAsk={(t) => void ask(t)}
      onClear={clear}
      disabledNote={allowed ? undefined : lockedMessage('ai.assist', caps)}
    >
      {state.status === 'ready' ? (
        <div data-testid="typeface-suggestion" className="grid gap-2 rounded-md border border-line bg-sheet p-3 text-sm">
          <p className="font-bold text-ink-strong">Suggested settings</p>
          {(() => {
            const changes = changesFor(handle.face, state.data)
            return changes.length ? (
              <ul className="grid gap-0.5">{changes.map((c) => <li key={c.label}><span className="font-semibold">{c.label}:</span> {c.from} → {c.to}</li>)}</ul>
            ) : (
              <p className="text-ink-soft">These settings are what the design already has.</p>
            )
          })()}
          {state.data.rationale ? <p className="text-ink-soft">{state.data.rationale}</p> : null}
          <p className="text-xs text-ink-soft">A restore point is saved first, so Restore points can bring the current design back. Switching family loads that family’s defaults before the settings go on top, which is why more than the suggested settings can change; your glyph overrides are kept.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={changesFor(handle.face, state.data).length === 0} onClick={() => apply(state.data)}>Apply to the design</Button>
            <Button variant="ghost" onClick={clear}>Ignore</Button>
          </div>
        </div>
      ) : null}
    </BriefBox>
  )
}
