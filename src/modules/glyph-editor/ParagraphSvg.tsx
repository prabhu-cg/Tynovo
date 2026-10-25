import { useId } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { deriveMetrics } from '../typeface-engine/dna'
import { layoutText } from './layout'

export interface ParagraphSettings {
  sizePx: number
  /** Font units added after every character. */
  tracking: number
  /** Font units added to every space. */
  wordSpacing: number
  /** Line height as a multiple of the font size. */
  lineHeight: number
}

/**
 * Editor preview of a paragraph: the glyph outlines drawn as SVG at a real pixel size, wrapped to `widthPx`.
 * It shows the design data (outlines, advance widths, kerning pairs). It is not text rendering, so it has no
 * hinting, no OS anti-aliasing and no shaping beyond kerning; the exported-font panel next to it is the file as
 * a browser draws it.
 */
export function ParagraphSvg({ face, text, widthPx, settings, guides, label }: { face: CustomTypeface; text: string; widthPx: number; settings: ParagraphSettings; guides: boolean; label: string }) {
  const titleId = useId()
  const m = deriveMetrics(face.dna)
  const unitsPerPx = 1000 / settings.sizePx
  const usable = Math.max(widthPx, 40)
  const layout = layoutText(face, text, { tracking: settings.tracking, wordSpacing: settings.wordSpacing, maxWidth: usable * unitsPerPx })
  const lineUnits = settings.lineHeight * 1000
  const baselineIn = (lineUnits - (m.ascender - m.descender)) / 2 + m.ascender
  const height = Math.max(layout.lines.length, 1) * lineUnits
  const vw = usable * unitsPerPx
  return (
    <svg role="img" aria-labelledby={titleId} width={usable} height={(height / 1000) * settings.sizePx} viewBox={`0 0 ${vw} ${height}`} className="block max-w-full">
      <title id={titleId}>{label}</title>
      {layout.lines.map((line, li) => {
        const y = li * lineUnits + baselineIn
        return (
          <g key={li}>
            {guides ? <line x1={0} x2={vw} y1={y} y2={y} stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 4" /> : null}
            <g transform={`translate(0 ${y}) scale(1 -1)`} fill="var(--color-ink-strong)">
              {line.items.map((it, i) => <path key={`${it.char}${i}`} d={it.d} transform={`translate(${it.x} 0)`} />)}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
