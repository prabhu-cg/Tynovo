import { useMemo } from 'react'
import type { Glyph, FontMetrics } from '@/modules/brand-projects/schema'
import { glyphToSvgPath } from './geometry'

/** One glyph drawn on its baseline, with the baseline, x-height and cap-height lines. */
export function GlyphThumb({ glyph, metrics, tone = 'ink', guides = true }: { glyph: Glyph; metrics: FontMetrics; tone?: 'ink' | 'danger'; guides?: boolean }) {
  const d = useMemo(() => glyphToSvgPath(glyph.contours), [glyph])
  const pad = 40
  const w = Math.max(glyph.advanceWidth, 200) + pad * 2
  const h = metrics.ascender - metrics.descender + pad * 2
  return (
    <svg viewBox={`${-pad} ${-(metrics.ascender + pad)} ${w} ${h}`} className="h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {guides
        ? [0, metrics.xHeight, metrics.capHeight].map((y, i) => (
            <line key={y} x1={-pad} x2={w - pad} y1={-y} y2={-y} stroke={i === 0 ? 'var(--color-accent)' : 'var(--color-line)'} strokeWidth={i === 0 ? 3 : 2} />
          ))
        : null}
      <g transform="scale(1 -1)" fill={tone === 'danger' ? 'var(--color-danger)' : 'var(--color-ink-strong)'}>
        <path d={d} />
      </g>
    </svg>
  )
}
