import { useState } from 'react'
import { LEVEL_IDS } from '@/modules/typography-system/tokens'
import { setBodyStep, setHeadingStep, setResponsive } from '@/modules/brand-system/ops'
import { Banner, NumberField } from '@/modules/shared-ui'
import { computeScale, sizeSpec } from '@/modules/typography-system/scale'
import { typographyIssues } from '@/modules/typography-system/validate'
import { useProject } from '../project'

const sizeText = (min: number, max: number) => (min === max ? `${max}px` : `${min}px to ${max}px`)

/** Base size and ratio, fluid sizing, heading levels and body sizes. Hard limits refuse a value; unusual ones are explained. */
export function ScaleEditor() {
  const { draft, editor } = useProject()
  const { scale, responsive, sizes } = draft.typography
  const steps = computeScale(scale)
  const [respError, setRespError] = useState<string | null>(null)
  const issues = typographyIssues(draft).filter((i) => i.field !== 'role')
  const body = draft.typography.roles.find((r) => r.kind === 'body')
  const setScale = (key: 'baseSizePx' | 'ratio', v: number) => editor.patch((p) => ({ ...p, typography: { ...p.typography, scale: { ...p.typography.scale, [key]: v } } }))
  const patchResp = (patch: Partial<typeof responsive>) => {
    const next = { ...responsive, ...patch }
    if (next.minViewportPx >= next.maxViewportPx) {
      setRespError('The small screen width must be narrower than the large screen width.')
      return
    }
    setRespError(null)
    editor.patch((p) => setResponsive(p, patch))
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div className="flex flex-wrap gap-4">
          <NumberField label="Base size (px)" value={scale.baseSizePx} min={8} max={64} onCommit={(v) => setScale('baseSizePx', v)} />
          <NumberField label="Ratio" value={scale.ratio} min={1} max={3} step={0.05} onCommit={(v) => setScale('ratio', v)} />
        </div>
        <ol aria-label="Scale steps" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
          {[...steps].reverse().map((s) => {
            const spec = sizeSpec(draft.typography, s.step)
            return (
              <li key={s.step} className="flex items-baseline gap-4 overflow-hidden px-4 py-2">
                <span className="tnum w-36 shrink-0 text-xs text-ink-soft">Step {s.step} · {sizeText(spec.minPx, spec.maxPx)}</span>
                <span className="truncate whitespace-nowrap text-ink-strong" style={{ fontSize: Math.min(spec.maxPx, 72), lineHeight: 1.3, paddingBottom: '0.15em' }}>Hamburgefonstiv</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h3 className="text-base font-bold">Heading and body sizes</h3>
        <p className="max-w-2xl text-sm text-ink-soft">Each is a step on the scale above. Headings use the heading role’s font, weight and spacing; body sizes use the body role’s. Display, interface and caption sizes are set on their roles.</p>
        <div className="flex flex-wrap gap-4">
          {sizes.headings.map((step, i) => (
            <NumberField key={LEVEL_IDS[i]} label={`Heading ${i + 1} step`} value={step} min={-6} max={12} onCommit={(v) => editor.patch((p) => setHeadingStep(p, i, Math.round(v)))} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Body large step" value={sizes.bodyLarge} min={-6} max={12} onCommit={(v) => editor.patch((p) => setBodyStep(p, 'bodyLarge', Math.round(v)))} />
          <div className="grid gap-1 text-sm font-semibold text-ink-strong">
            <span>Body step</span>
            <span className="tnum min-h-9 content-center text-sm font-normal text-ink">{body ? `${body.scaleStep} (set on ${body.name})` : 'no body role'}</span>
          </div>
          <NumberField label="Body small step" value={sizes.bodySmall} min={-6} max={12} onCommit={(v) => editor.patch((p) => setBodyStep(p, 'bodySmall', Math.round(v)))} />
        </div>
        <dl className="tnum grid max-w-2xl grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-x-6 gap-y-1 text-sm">
          {[...sizes.headings.map((s, i) => [`Heading ${i + 1}`, s] as const), ['Body large', sizes.bodyLarge] as const, ['Body small', sizes.bodySmall] as const].map(([label, step]) => {
            const spec = sizeSpec(draft.typography, step)
            return <div key={label} className="flex justify-between gap-3"><dt className="text-ink-soft">{label}</dt><dd>{sizeText(spec.minPx, spec.maxPx)}</dd></div>
          })}
        </dl>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h3 className="text-base font-bold">Responsive sizes</h3>
        <label className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-ink-strong md:min-h-9">
          <input type="checkbox" checked={responsive.enabled} onChange={(e) => editor.patch((p) => setResponsive(p, { enabled: e.target.checked }))} className="size-4 accent-accent" />
          Make sizes fluid
        </label>
        <p className="max-w-2xl text-sm text-ink-soft">
          {responsive.enabled
            ? 'Below the small screen width every size comes from the small scale; above the large screen width, from the main scale above; in between they grow smoothly. The exported CSS uses clamp(), and the previews compute the same sizes.'
            : 'Off: every size is fixed. Turn it on to give small screens a smaller scale without writing media queries.'}
        </p>
        {responsive.enabled ? (
          <div className="flex flex-wrap gap-4">
            <NumberField label="Small screen width (px)" value={responsive.minViewportPx} min={240} max={900} onCommit={(v) => patchResp({ minViewportPx: Math.round(v) })} />
            <NumberField label="Large screen width (px)" value={responsive.maxViewportPx} min={600} max={3000} onCommit={(v) => patchResp({ maxViewportPx: Math.round(v) })} />
            <NumberField label="Small scale base (px)" value={responsive.minBaseSizePx} min={8} max={64} onCommit={(v) => patchResp({ minBaseSizePx: v })} />
            <NumberField label="Small scale ratio" value={responsive.minRatio} min={1} max={3} step={0.025} onCommit={(v) => patchResp({ minRatio: v })} />
          </div>
        ) : null}
        {respError ? <p role="alert" className="text-sm text-danger">{respError}</p> : null}
      </div>

      <section aria-label="Checks on these values" className="grid gap-2">
        <h3 className="text-base font-bold">Check your values</h3>
        {issues.length === 0 ? (
          <p role="status" data-testid="scale-checks" className="text-sm text-ink-soft">Nothing unusual in the scale, sizes or responsive settings.</p>
        ) : (
          <Banner tone="warn">
            <ul data-testid="scale-checks" className="grid gap-1">{issues.map((i) => <li key={i.id}>{i.message}</li>)}</ul>
          </Banner>
        )}
        <p className="text-xs text-ink-soft">These are rules of thumb about unusual values, not a legibility or accessibility test.</p>
      </section>
    </div>
  )
}
