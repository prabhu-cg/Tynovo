import { useId } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { deriveMetrics } from '../typeface-engine/dna'
import { layoutRun } from './layout'

/** Outline specimen: the actual glyph geometry drawn as SVG, optionally with metric guide lines. */
export function SpecimenSvg({ face, text, guides = true, label }: { face: CustomTypeface; text: string; guides?: boolean; label: string }) {
  const { items, width } = layoutRun(face, text)
  const m = deriveMetrics(face.dna)
  const pad = 60
  const top = m.ascender + pad
  const height = m.ascender - m.descender + pad * 2
  const vw = Math.max(width, 1) + pad * 2
  const titleId = useId()
  const lines: Array<{ y: number; name: string; accent?: boolean }> = [
    { y: m.ascender, name: 'ascender' },
    { y: m.capHeight, name: 'cap height' },
    { y: 0, name: 'baseline', accent: true },
    { y: m.descender, name: 'descender' },
  ]
  return (
    <svg role="img" aria-labelledby={titleId} viewBox={`0 0 ${vw} ${height}`} className="h-auto w-full" preserveAspectRatio="xMinYMid meet">
      <title id={titleId}>{label}</title>
      {guides &&
        lines.map((l) => (
          <line key={l.name} x1={0} x2={vw} y1={top - l.y} y2={top - l.y} stroke={l.accent ? 'var(--color-accent)' : 'var(--color-line-strong)'} strokeWidth={l.accent ? 3 : 2} strokeDasharray={l.accent ? undefined : '8 10'} />
        ))}
      <g transform={`translate(${pad} ${top}) scale(1 -1)`} fill="var(--color-ink-strong)" fillRule="nonzero">
        {items.map((it, i) => (
          <path key={`${it.char}${i}`} d={it.d} transform={`translate(${it.x} 0)`} />
        ))}
      </g>
    </svg>
  )
}
