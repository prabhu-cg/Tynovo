import { suggestBrand } from '@/modules/ai/client'
import type { BrandSuggestion } from '@/modules/ai/schemas'
import { PRIORITY_LABEL, TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { lockedMessage } from '@/modules/entitlements'
import { Button } from '@/modules/shared-ui'
import { useCapabilities } from '../entitlements'
import { useProject } from '../project'
import { BriefBox } from './BriefBox'
import { useAssist } from './useAssist'

const list = (items: string[]) => (items.length ? items.join(', ') : 'none suggested')

/** Describe the brand in a few sentences; get personality words, uses, tones and priorities to accept or ignore. */
export function BrandBriefAssist() {
  const { editor } = useProject()
  const caps = useCapabilities()
  const allowed = caps.allows('ai.assist')
  const { state, ask, clear } = useAssist(suggestBrand)

  const apply = (s: BrandSuggestion) => {
    editor.patch((p) => ({
      ...p,
      brand: { ...p.brand, personality: s.personality.length ? s.personality : p.brand.personality, useCases: s.useCases.length ? s.useCases : p.brand.useCases, tones: s.tones.length ? s.tones : p.brand.tones, readabilityPriority: s.readabilityPriority, displayPriority: s.displayPriority },
    }))
    clear()
  }

  return (
    <BriefBox
      id="brand"
      title="Suggest a brand direction from a brief"
      label="Describe the brand in a few sentences"
      placeholder="A small roastery that sells coffee by subscription. Warm and unhurried, writes long tasting notes, sells online and in print."
      button="Suggest a direction"
      state={state}
      onAsk={(t) => void ask(t)}
      onClear={clear}
      disabledNote={allowed ? undefined : lockedMessage('ai.assist', caps)}
    >
      {state.status === 'ready' ? (
        <div data-testid="brand-suggestion" className="grid gap-2 rounded-md border border-line bg-sheet p-3 text-sm">
          <p className="font-bold text-ink-strong">Suggestion</p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Personality</dt><dd>{list(state.data.personality)}</dd>
            <dt className="font-semibold">Used for</dt><dd>{list(state.data.useCases.map((u) => USE_CASE_LABEL[u]))}</dd>
            <dt className="font-semibold">Tone</dt><dd>{list(state.data.tones.map((t) => TONE_LABEL[t]))}</dd>
            <dt className="font-semibold">Readability</dt><dd>{PRIORITY_LABEL[state.data.readabilityPriority]}</dd>
            <dt className="font-semibold">Display use</dt><dd>{PRIORITY_LABEL[state.data.displayPriority]}</dd>
          </dl>
          {state.data.rationale ? <p className="text-ink-soft">{state.data.rationale}</p> : null}
          <p className="text-xs text-ink-soft">Applying replaces your current personality words, use cases, tones and the two priorities. A suggestion from a language model is a starting point, not a verdict.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => apply(state.data)}>Apply to brand direction</Button>
            <Button variant="ghost" onClick={clear}>Ignore</Button>
          </div>
        </div>
      ) : null}
    </BriefBox>
  )
}
