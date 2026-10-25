import { useDeferredValue, useId, useMemo, useState } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { compareRendering, type RenderingComparison } from '@/modules/font-export/renderingCheck'
import { useGeneratedFontFace } from '@/modules/font-export/useGeneratedFontFace'
import { ParagraphSvg, type ParagraphSettings } from '@/modules/glyph-editor/ParagraphSvg'
import { useElementWidth } from '@/modules/glyph-editor/useElementWidth'
import { Banner, Button, inputClass, RangeField, Segmented } from '@/modules/shared-ui'

const PRESETS = {
  sample: { label: 'Sample', text: 'Hamburgefonstiv\nThe quick brown fox jumps over the lazy dog' },
  alphabet: { label: 'Alphabet', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz' },
  numerals: { label: 'Numerals', text: '0123456789\n1,024.50  $ % # + - = /\n2026-10-25  12:45' },
  spacing: { label: 'Spacing', text: 'HHOHOOHH\nnnonoonn\nAV AT AY LT LY TA TO VA WA YA\nrn rm cl ni nu il li' },
  words: { label: 'Words', text: 'Rhythm Waffle Typography\nQuixotic Jazz Illicit Minimum\nFlying Gravity Yellow Kerning' },
} as const
type PresetId = keyof typeof PRESETS
type Show = 'both' | 'editor' | 'file'

const DEFAULTS = { sizePx: 64, tracking: 0, wordSpacing: 0, lineHeight: 1.3 } satisfies ParagraphSettings
const fmtEm = (units: number) => `${units > 0 ? '+' : ''}${(units / 1000).toFixed(3)} em`

type Check = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: RenderingComparison } | { status: 'error'; message: string }

export function PreviewTab({ face }: { face: CustomTypeface }) {
  const [preset, setPreset] = useState<PresetId | 'custom'>('sample')
  const [text, setText] = useState<string>(PRESETS.sample.text)
  const [settings, setSettings] = useState<ParagraphSettings>(DEFAULTS)
  const [guides, setGuides] = useState(false)
  const [show, setShow] = useState<Show>('both')
  const [check, setCheck] = useState<Check>({ status: 'idle' })
  const textId = useId()
  const live = useDeferredValue(face)
  const family = `Studio Preview ${useId().replace(/[^A-Za-z0-9]/g, '')}`
  const fontState = useGeneratedFontFace(live, family)
  const [width, widthRef] = useElementWidth()
  const analysis = useMemo(() => analyzeTypeface(live), [live])
  const absent = [...new Set([...text])].filter((c) => c !== '\n' && analysis.reports.get(c)?.status !== 'supported')
  const set = <K extends keyof ParagraphSettings>(k: K, v: ParagraphSettings[K]) => setSettings((s) => ({ ...s, [k]: v }))
  const spacingChanged = settings.tracking !== 0 || settings.wordSpacing !== 0

  const runCheck = async () => {
    setCheck({ status: 'running' })
    try {
      setCheck({ status: 'done', result: await compareRendering(live, text, family) })
    } catch (e) {
      setCheck({ status: 'error', message: e instanceof Error ? e.message : 'The comparison could not run.' })
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <section aria-label="Preview settings" className="grid gap-4">
        <Segmented label="Specimen" value={preset === 'custom' ? ('sample' as PresetId) : preset} options={(Object.keys(PRESETS) as PresetId[]).map((k) => ({ value: k, label: PRESETS[k].label }))} onChange={(k) => { setPreset(k); setText(PRESETS[k].text); setCheck({ status: 'idle' }) }} />
        <div className="grid gap-1">
          <label htmlFor={textId} className="text-sm font-semibold text-ink-strong">Preview text</label>
          <textarea id={textId} value={text} rows={3} maxLength={600} onChange={(e) => { setText(e.target.value); setPreset('custom'); setCheck({ status: 'idle' }) }} className={`${inputClass} min-h-24 py-2 leading-snug`} />
          <p className="text-xs text-ink-soft">Type anything. A new line starts a new line of text.</p>
        </div>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <RangeField label="Size" value={settings.sizePx} min={16} max={240} step={2} format={(v) => `${v} px`} defaultValue={DEFAULTS.sizePx} onChange={(v) => set('sizePx', v)} />
          <RangeField label="Letter spacing" value={settings.tracking} min={-100} max={300} step={5} format={fmtEm} defaultValue={0} onChange={(v) => set('tracking', v)} />
          <RangeField label="Word spacing" value={settings.wordSpacing} min={-200} max={600} step={10} format={fmtEm} defaultValue={0} onChange={(v) => set('wordSpacing', v)} />
          <RangeField label="Line height" value={settings.lineHeight} min={1} max={2} step={0.05} format={(v) => v.toFixed(2)} defaultValue={DEFAULTS.lineHeight} onChange={(v) => set('lineHeight', v)} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-strong md:min-h-9"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="size-4 accent-accent" />Baselines</label>
          <div className="w-full sm:w-80"><Segmented label="Show" value={show} options={[{ value: 'both', label: 'Both' }, { value: 'editor', label: 'Editor preview' }, { value: 'file', label: 'Exported file' }]} onChange={setShow} /></div>
          {spacingChanged ? <Button variant="ghost" onClick={() => setSettings((s) => ({ ...s, tracking: 0, wordSpacing: 0 }))}>Reset spacing</Button> : null}
        </div>
        <p className="max-w-3xl text-xs text-ink-soft">Letter and word spacing here change only how this preview is drawn. They are not saved and not written into the font; set a glyph’s own spacing in the glyph editor, and kerning pairs under Quality.</p>
      </section>

      {absent.length > 0 ? (
        <p role="status" className="text-sm text-ink-soft">Not in this typeface, so left out of the editor preview and drawn in a fallback font in the exported-file panel: <span className="font-semibold text-ink-strong">{absent.map((c) => (c === ' ' ? 'space' : c)).join(' ')}</span></p>
      ) : null}

      <div ref={widthRef} className="grid min-w-0 gap-5">
        {show !== 'file' ? (
          <section aria-labelledby="pv-editor" className="min-w-0 rounded-md border border-line bg-paper p-4 md:p-6">
            <h2 id="pv-editor" className="text-sm font-bold text-ink-strong">Editor preview</h2>
            <p className="mb-3 text-xs text-ink-soft">Drawn from the glyph data: outlines, advance widths and kerning pairs. No hinting or operating-system text rendering.</p>
            <ParagraphSvg face={live} text={text || ' '} widthPx={width - 50} settings={settings} guides={guides} label={`Editor preview: ${text.split('\n')[0]}`} />
          </section>
        ) : null}

        {show !== 'editor' ? (
          <section aria-labelledby="pv-file" className="min-w-0 rounded-md border border-line bg-paper p-4 md:p-6">
            <h2 id="pv-file" className="text-sm font-bold text-ink-strong">Exported file, as the browser draws it</h2>
            <p className="mb-3 text-xs text-ink-soft">A real TrueType file is built from this typeface and loaded by your browser, which draws this text. Other programs may differ in rendering and kerning support.</p>
            {fontState === 'failed' ? (
              <Banner tone="error">The font file could not be built or loaded, so there is nothing to show here. The editor preview is unaffected, and nothing in your project changed. The Quality view lists the likely cause.</Banner>
            ) : (
              <p
                data-testid="exported-preview"
                data-font-state={fontState}
                aria-label={`Exported font preview: ${text.split('\n')[0]}`}
                className={`min-w-0 break-words whitespace-pre-wrap text-ink-strong transition-opacity ${fontState === 'ready' ? 'opacity-100' : 'opacity-40'}`}
                style={{ fontFamily: `'${family}', monospace`, fontSize: settings.sizePx, lineHeight: settings.lineHeight, letterSpacing: `${settings.tracking / 1000}em`, wordSpacing: `${settings.wordSpacing / 1000}em` }}
              >
                {text || ' '}
              </p>
            )}
            {fontState === 'loading' ? <p role="status" className="mt-2 text-xs text-ink-soft">Building the font file…</p> : null}
          </section>
        ) : null}
      </div>

      <section aria-labelledby="pv-check" className="grid max-w-3xl gap-3 rounded-md border border-line bg-paper p-4">
        <div>
          <h2 id="pv-check" className="text-sm font-bold text-ink-strong">Does the exported file match the editor preview?</h2>
          <p className="text-xs text-ink-soft">Draws the first line both ways at 160 px with default spacing and compares the total width and the inked pixels. Differences under a pixel at the edges are ignored as anti-aliasing.</p>
        </div>
        <div><Button disabled={fontState !== 'ready' || check.status === 'running'} onClick={() => void runCheck()}>{check.status === 'running' ? 'Comparing…' : 'Compare preview with exported file'}</Button></div>
        {check.status === 'error' ? <Banner tone="error">{check.message}</Banner> : null}
        {check.status === 'done' ? <RenderingResult r={check.result} /> : null}
      </section>
    </div>
  )
}

function RenderingResult({ r }: { r: RenderingComparison }) {
  const widthDiff = Math.abs(r.previewWidth - r.fontWidth)
  const widthOk = widthDiff <= 1
  const overlapOk = r.overlap !== null && r.overlap >= 0.98
  return (
    <div data-testid="rendering-result" className="grid gap-2 text-sm">
      <p className="text-xs text-ink-soft">Compared: “{r.text}”</p>
      <p className="tnum"><strong className={widthOk ? 'text-ok' : 'text-danger'}>{widthOk ? 'Widths match.' : 'Widths differ.'}</strong> Editor preview {Math.round(r.previewWidth)} units, exported file {Math.round(r.fontWidth)} units{widthOk ? '' : ` (${Math.round(widthDiff)} apart)`}.</p>
      {r.overlap === null ? <p className="text-ink-soft">The pixels could not be read in this browser, so only the widths were compared.</p> : (
        <p className="tnum"><strong className={overlapOk ? 'text-ok' : 'text-danger'}>{overlapOk ? 'Shapes match.' : 'Shapes differ.'}</strong> {(r.overlap * 100).toFixed(1)}% of the inked pixels agree, to within one pixel. {overlapOk ? '' : 'That is more than anti-aliasing explains: the file draws something different from the preview.'}</p>
      )}
    </div>
  )
}
