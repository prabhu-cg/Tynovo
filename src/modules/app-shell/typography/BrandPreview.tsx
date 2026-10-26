import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { missingChars } from '@/modules/brand-system/fit'
import { resolveRole, rolesUsingCustom } from '@/modules/brand-system/fonts'
import { brandName } from '@/modules/brand-system/brand'
import { applicationSlots, APPLICATIONS, effectiveCopy, previewMissing, styleForSlot, styleProps, type ApplicationId, type PreviewCopy, type Slot } from '@/modules/brand-system/preview'
import { useElementWidth } from '@/modules/glyph-editor/useElementWidth'
import { Banner, Button, inputClass, Segmented } from '@/modules/shared-ui'
import { useProject } from '../project'

const COPY_FIELDS: ReadonlyArray<{ key: keyof PreviewCopy; label: string; rows: number }> = [
  { key: 'headline', label: 'Headline', rows: 2 },
  { key: 'subhead', label: 'Subheading', rows: 2 },
  { key: 'body', label: 'Paragraph', rows: 4 },
  { key: 'longform', label: 'Long-form text (separate paragraphs with a blank line)', rows: 9 },
  { key: 'caption', label: 'Caption', rows: 1 },
  { key: 'action', label: 'Button label', rows: 1 },
]

type Surface = 'light' | 'dark'
type Size = 'phone' | 'tablet' | 'fit'
const SIZE_PX = { phone: 390, tablet: 768 } as const

const THEMES = {
  light: { bg: '#ffffff', fg: '#262626', soft: '#6b6b6b', line: '#e3e3e0', sheet: '#f6f6f5' },
  dark: { bg: '#1f1f1d', fg: '#f4f4f2', soft: '#c4c4bf', line: '#3c3c39', sheet: '#2a2a28' },
} as const

/**
 * The system applied: a website, an editorial page, a product screen and a poster, on a light or dark surface at
 * a chosen width. Every size, family, weight, line height and spacing is read from the same project data as the
 * exported CSS (typography-system/tokens), and sizes follow the responsive settings at the width shown.
 */
export function BrandPreview() {
  const { draft, editor, customFont } = useProject()
  const [app, setApp] = useState<ApplicationId>('website')
  const [surface, setSurface] = useState<Surface>('light')
  const [size, setSize] = useState<Size>('fit')
  const [fitWidth, widthRef] = useElementWidth()
  const copy = effectiveCopy(draft)
  const slots = useMemo(() => applicationSlots(draft, effectiveCopy(draft), app), [draft, app])
  const missing = useMemo(() => previewMissing(draft, slots), [draft, slots])
  const face = draft.customTypeface
  const usingCustom = rolesUsingCustom(draft)
  const width = size === 'fit' ? Math.max(280, Math.round(fitWidth) || 800) : SIZE_PX[size]
  const t = THEMES[surface]
  const hasSaved = Object.keys(draft.brand.sampleCopy).length > 0

  const byId = new Map(slots.map((s) => [s.id, s]))
  /** One piece of preview text, set in its style. Characters the custom typeface cannot draw are underlined. */
  const text = (id: string, className = '', opts: { as?: 'p' | 'span' | 'div'; color?: string; style?: CSSProperties } = {}): ReactNode => {
    const slot = byId.get(id) as Slot
    const style = styleForSlot(draft, slot.style)
    const role = style?.role ?? null
    const font = role ? resolveRole(draft, role) : null
    const absent = font?.origin === 'custom' && face ? new Set(missingChars(face, slot.text)) : null
    const props = styleProps(draft, style, width)
    const Tag = opts.as ?? 'p'
    return (
      <Tag
        data-slot={id}
        data-style={slot.style}
        data-role={role?.name ?? 'none'}
        data-font-origin={font?.origin ?? 'none'}
        data-size={typeof props.fontSize === 'number' ? props.fontSize : undefined}
        className={`min-w-0 break-words ${className}`}
        style={{ ...props, color: opts.color ?? t.fg, ...opts.style }}
      >
        {absent && absent.size > 0
          ? [...slot.text].map((c, i) => (absent.has(c) ? <span key={i} data-missing={c} className="underline decoration-danger decoration-wavy underline-offset-4">{c}</span> : c))
          : slot.text}
      </Tag>
    )
  }
  const soft = { color: t.soft }
  const button = (id: string) => <span className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-white">{text(id, '', { as: 'span', color: '#ffffff' })}</span>

  const rolesWithout = (['display', 'heading', 'body', 'ui', 'caption'] as const).filter((k) => !draft.typography.roles.some((r) => r.kind === k))
  const label = APPLICATIONS.find((a) => a.id === app)!.label

  return (
    <div className="grid min-w-0 gap-5" data-testid="brand-preview" data-app={app} data-surface={surface} data-viewport={width} data-custom-font-state={customFont.state} data-custom-font-revision={customFont.revision}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <Segmented label="Context" value={app} options={APPLICATIONS.map((a) => ({ value: a.id, label: a.label }))} onChange={setApp} />
        <Segmented label="Surface" value={surface} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={setSurface} />
        <Segmented label="Width" value={size} options={[{ value: 'phone', label: 'Phone 390' }, { value: 'tablet', label: 'Tablet 768' }, { value: 'fit', label: 'Fit' }]} onChange={setSize} />
      </div>
      <p role="status" className="tnum text-sm text-ink-soft">
        Showing {label.toLowerCase()} at {width}px wide{draft.typography.responsive.enabled ? ', with fluid sizes for this width' : ''}.
        {face && usingCustom.length > 0 ? (customFont.state === 'ready' ? <> Your typeface <strong className="text-ink-strong">{face.familyName}</strong> is drawn in {usingCustom.map((r) => r.name).join(', ')} from your current design.</> : customFont.state === 'failed' ? ' The custom typeface could not be built, so those roles show in the fallback font.' : ' Building the custom typeface for this preview…') : null}
      </p>

      {missing.length > 0 ? (
        <Banner tone="warn">
          <strong>The custom typeface cannot draw some characters in this preview.</strong>
          <ul className="mt-1 grid gap-0.5">
            {missing.map((m) => (
              <li key={m.role.id} data-missing-role={m.role.name}>
                <span className="font-semibold">{m.role.name}</span>: <span className="font-semibold" aria-label={`missing characters ${m.chars.join(' ')}`}>{m.chars.map((c) => (c === ' ' ? 'space' : c)).join(' ')}</span> are drawn in a fallback font. They are underlined below, and the same happens in exports.
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}
      {rolesWithout.length > 0 ? <p className="text-sm text-ink-soft">There is no {rolesWithout.join(', ')} role, so text that would use it is shown unstyled. Add one under Roles.</p> : null}

      <div ref={widthRef} className="min-w-0">
        <div className="overflow-x-auto">
          <section aria-label={`${label} preview`} data-testid="preview-surface" className="mx-auto min-w-0 overflow-hidden rounded-md border" style={{ width, maxWidth: size === 'fit' ? '100%' : undefined, background: t.bg, color: t.fg, borderColor: t.line }}>
            {app === 'website' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-5 py-3" style={{ borderColor: t.line }}>
                  {text('brand', '', { as: 'span' })}
                  <div className="flex gap-5">{text('nav-1', '', { as: 'span', color: t.soft })}{text('nav-2', '', { as: 'span', color: t.soft })}{text('nav-3', '', { as: 'span', color: t.soft })}</div>
                </div>
                <div className="grid gap-4 px-5 py-10">
                  {text('headline', 'max-w-[18ch]')}
                  {text('subhead', '', { color: t.soft })}
                  {text('body', 'max-w-[62ch]', { color: t.soft })}
                  <div>{button('action')}</div>
                </div>
                <div className="grid gap-2 border-t px-5 py-6" style={{ borderColor: t.line, background: t.sheet }}>
                  {text('article-title')}
                  {text('article-body', 'max-w-[62ch]', { color: t.soft })}
                  {text('caption', '', { style: soft })}
                </div>
              </>
            ) : null}
            {app === 'editorial' ? (
              <article className="mx-auto grid max-w-[44rem] gap-4 px-5 py-10">
                {text('kicker', 'uppercase', { color: t.soft })}
                {text('title')}
                {text('deck', '', { color: t.soft })}
                {text('byline', 'border-b pb-4', { style: { ...soft, borderColor: t.line } })}
                {slots.filter((s) => s.id.startsWith('p-') || s.id === 'h2' || s.id === 'h3' || s.id === 'note').map((s) => <div key={s.id}>{text(s.id, s.id.startsWith('p-') ? '' : 'mt-3', { color: s.id === 'note' ? t.soft : t.fg })}</div>)}
              </article>
            ) : null}
            {app === 'product' ? (
              <div className="grid">
                <div className="grid content-start gap-4 p-5">
                  {text('title')}
                  {text('lede', '', { color: t.soft })}
                  <div className="grid gap-1">{text('label-email', '', { color: t.soft })}<div className="rounded-md border px-3 py-2" style={{ borderColor: t.line }}>{text('value-email')}</div></div>
                  <div className="grid gap-1">{text('label-plan', '', { color: t.soft })}<div className="rounded-md border px-3 py-2" style={{ borderColor: t.line }}>{text('value-plan')}</div></div>
                  <div>{button('action')}</div>
                </div>
                <div className="grid content-start gap-3 border-t p-5" style={{ borderColor: t.line, background: t.sheet }}>
                  {text('row-1')}
                  <div className="border-t" style={{ borderColor: t.line }} />
                  {text('row-2', '', { color: t.soft })}
                  <div className="border-t" style={{ borderColor: t.line }} />
                  {text('caption', '', { style: soft })}
                </div>
              </div>
            ) : null}
            {app === 'poster' ? (
              <div className="mx-auto grid aspect-[4/5] max-w-md content-between bg-accent p-7">
                {text('brand', 'uppercase', { color: '#ffffff' })}
                <div className="grid gap-3">{text('headline', '', { color: '#ffffff' })}{text('subhead', '', { color: '#ffffff' })}</div>
                {text('caption', '', { color: '#ffffff' })}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <details className="max-w-3xl text-sm" data-testid="copy-editor">
        <summary className="cursor-pointer font-semibold text-ink-strong">Change the sample text</summary>
        <div className="mt-3 grid gap-3">
          <p className="text-xs text-ink-soft">The brand name is “{brandName(draft)}”, from the brand direction. Your sample text is saved with the project, and the specimen uses it too.</p>
          {COPY_FIELDS.map((f) => (
            <label key={f.key} className="grid gap-1 font-semibold text-ink-strong">
              {f.label}
              <textarea rows={f.rows} maxLength={2000} value={copy[f.key]} onChange={(e) => editor.patch((p) => ({ ...p, brand: { ...p.brand, sampleCopy: { ...p.brand.sampleCopy, [f.key]: e.target.value } } }))} className={`${inputClass} py-2 font-normal`} />
            </label>
          ))}
          <div><Button disabled={!hasSaved} onClick={() => editor.patch((p) => ({ ...p, brand: { ...p.brand, sampleCopy: {} } }))}>Reset to the studio’s sample text</Button></div>
        </div>
      </details>
    </div>
  )
}
