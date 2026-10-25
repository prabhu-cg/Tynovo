import { Banner, NumberField } from '@/modules/shared-ui'
import { computeScale, sizeForStep } from '@/modules/typography-system/scale'
import { useProject } from './project'

export function TypographyPage() {
  const { draft, editor } = useProject()
  const scale = draft.typography.scale
  const steps = computeScale(scale)
  const setScale = (key: 'baseSizePx' | 'ratio', v: number) =>
    editor.patch((p) => ({ ...p, typography: { ...p.typography, scale: { ...p.typography.scale, [key]: v } } }))
  return (
    <div className="grid gap-10">
      <Banner tone="info">
        <strong>Brand Typography System.</strong> The type scale is editable now. Choosing fonts, editing role settings and previewing brand applications are in development; the roles below show their default values.
      </Banner>

      <section aria-labelledby="scale-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="scale-h" className="text-lg font-bold">Type scale</h2>
          <p className="mt-1 text-sm text-ink-soft">Each step is the base size times the ratio to the power of its step number.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap gap-4">
            <NumberField label="Base size (px)" value={scale.baseSizePx} min={8} max={64} onCommit={(v) => setScale('baseSizePx', v)} />
            <NumberField label="Ratio" value={scale.ratio} min={1} max={3} step={0.05} onCommit={(v) => setScale('ratio', v)} />
          </div>
          <ol aria-label="Scale steps" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
            {[...steps].reverse().map((s) => (
              <li key={s.step} className="flex items-baseline gap-4 overflow-hidden px-4 py-2">
                <span className="tnum w-28 shrink-0 text-xs text-ink-soft">Step {s.step} · {s.sizePx}px</span>
                <span className="truncate whitespace-nowrap text-ink-strong" style={{ fontSize: Math.min(s.sizePx, 72), lineHeight: 1.2 }}>Hamburgefonstiv</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="roles-h" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <h2 id="roles-h" className="text-lg font-bold">Roles</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <caption className="sr-only">Typography roles</caption>
            <thead className="text-xs text-ink-soft uppercase"><tr><th className="py-2 font-semibold">Role</th><th className="font-semibold">Size</th><th className="font-semibold">Weight</th><th className="font-semibold">Line height</th><th className="font-semibold">Tracking</th></tr></thead>
            <tbody className="tnum divide-y divide-line border-t border-line">
              {draft.typography.roles.map((r) => (
                <tr key={r.id}><th scope="row" className="py-2 font-semibold text-ink-strong">{r.name}</th><td>{sizeForStep(scale, r.scaleStep)}px</td><td>{r.weight}</td><td>{r.lineHeight}</td><td>{r.letterSpacingEm}em</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
