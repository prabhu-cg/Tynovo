import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { GlyphThumb } from '@/modules/glyph-editor/GlyphThumb'
import { deriveMetrics } from '@/modules/typeface-engine/dna'
import { Banner, Button, ChevronLeftIcon } from '@/modules/shared-ui'
import type { TypefaceHandle } from './useTypeface'

const show = (c: string) => (c === ' ' ? 'space' : c)

/** A glyph looked at, not edited: its outline and measurements. Used where the project cannot be changed. */
export function GlyphViewer({ handle, char, onBack }: { handle: TypefaceHandle; char: string; onBack: () => void }) {
  const analysis = analyzeTypeface(handle.face)
  const report = analysis.reports.get(char)
  const glyph = report?.glyph ?? null
  const metrics = deriveMetrics(handle.face.dna)
  return (
    <div className="grid max-w-3xl gap-4">
      <Button className="justify-self-start" onClick={onBack}><ChevronLeftIcon />All glyphs</Button>
      <Banner tone="info">The outline of {show(char)} is shown for reading. Editing is switched off because this project is a read-only sample.</Banner>
      {glyph ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="aspect-[3/4] rounded-md border border-line bg-paper p-3" role="img" aria-label={`Outline of ${show(char)}`}>
            <GlyphThumb glyph={glyph} metrics={metrics} />
          </div>
          <dl className="tnum grid content-start gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-soft">Character</dt><dd>{show(char)}</dd>
            <dt className="text-ink-soft">Status</dt><dd>{report?.status}</dd>
            <dt className="text-ink-soft">Advance width</dt><dd>{glyph.advanceWidth} units</dd>
            <dt className="text-ink-soft">Contours</dt><dd>{glyph.contours.length}</dd>
            <dt className="text-ink-soft">Points</dt><dd>{glyph.contours.reduce((n, c) => n + c.length, 0)}</dd>
            <dt className="text-ink-soft">Hand-edited</dt><dd>{char in handle.face.overrides && handle.face.overrides[char]?.contours ? 'yes, with its own outline' : char in handle.face.overrides ? 'has overrides' : 'no, generated from the design'}</dd>
          </dl>
        </div>
      ) : (
        <Banner tone="info">{show(char)} has no design in this engine version, so there is no outline to show.</Banner>
      )}
    </div>
  )
}
