import { useMemo } from 'react'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { FAMILY_LABELS, type Family } from '@/modules/typeface-engine/dna'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { Button } from '@/modules/shared-ui'
import { viewOf, type FeatureId } from '@/modules/entitlements'
import { useCapabilities } from '../entitlements'
import { EditGroup } from '../EditGroup'
import { useProject } from '../project'

const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']

/** Empty state: pick a starting family. Each card is drawn by the real generator. */
export function CreateTypeface() {
  const { editor } = useProject()
  const caps = useCapabilities()
  const previews = useMemo(() => FAMILIES.map((f) => ({ family: f, face: createTypeface(`preview-${f}`, f) })), [])
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-xl font-extrabold">Start a typeface</h2>
        <p className="mt-1 max-w-2xl text-ink-soft">Choose a construction family. Every setting can be changed afterwards, and the family can be switched later without losing glyph overrides.</p>
      </div>
      <EditGroup>
      <ul className="grid gap-4 md:grid-cols-3">
        {previews.map(({ family, face }) => {
          const view = viewOf(`typeface.family.${family}` as FeatureId, caps)
          if (!view.visible) return null
          return (
          <li key={family} className="flex flex-col rounded-md border border-line bg-paper p-4">
            <div className="min-w-0"><SpecimenSvg face={face} text="Hamburg" guides={false} label={`${FAMILY_LABELS[family].name} family, sample text Hamburg`} /></div>
            <h3 className="mt-3 font-bold text-ink-strong">{FAMILY_LABELS[family].name}</h3>
            <p className="mt-1 grow text-sm text-ink-soft">{FAMILY_LABELS[family].blurb}</p>
            {view.locked ? <p data-testid="locked" className="mt-4 text-sm text-ink-soft">{view.message}</p> : null}
            <Button className="mt-4" variant="primary" disabled={view.locked} onClick={() => view.allowed && editor.patch((p) => ({ ...p, customTypeface: createTypeface(crypto.randomUUID(), family) }))}>Start with {FAMILY_LABELS[family].name}</Button>
          </li>
          )
        })}
      </ul>
      </EditGroup>
    </div>
  )
}
