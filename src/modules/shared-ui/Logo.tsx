import { MARK_COLORS, MARK_PATHS, MARK_VIEWBOX, PRODUCT_NAME, TAGLINE } from '@/modules/identity/identity'

/** The mark keeps the colours it was drawn in (the grey lightens on dark surfaces so it stays legible). */
const FILL = { ink: `var(--logo-ink, ${MARK_COLORS.ink})`, accent: 'var(--color-accent)' } as const

/** The Tynovo mark. Decorative: the name is always written out next to it. The grey is the logo's own; the orange is the accent token. */
export function LogoMark({ height = 32, className = '' }: { height?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      height={height}
      width={Math.round((height * MARK_VIEWBOX.width) / MARK_VIEWBOX.height)}
      className={`shrink-0 ${className}`}
      fill="none"
    >
      {MARK_PATHS.map((p) => <path key={p.d} d={p.d} fill={FILL[p.fill]} />)}
    </svg>
  )
}

const SIZES = {
  sm: { mark: 28, name: 'text-lg', tag: 'text-[0.6875rem]' },
  md: { mark: 34, name: 'text-xl', tag: 'text-xs' },
  lg: { mark: 52, name: 'text-3xl', tag: 'text-sm' },
} as const

/**
 * The lockup: the mark, the wordmark "Tynovo" and the tagline below it. It is text and a drawing, not a picture of
 * text, so it scales, translates and is read aloud as "Tynovo, Shape your brand’s voice".
 */
export function Logo({ size = 'md', tagline = true, className = '' }: { size?: keyof typeof SIZES; tagline?: boolean; className?: string }) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark height={s.mark} />
      <span className="grid leading-none">
        <span className={`${s.name} font-extrabold tracking-[-0.03em] text-ink-strong`}>{PRODUCT_NAME}</span>
        {tagline ? <span className={`${s.tag} mt-1 whitespace-nowrap font-medium tracking-[0.005em] text-ink-soft`}>{TAGLINE}</span> : null}
      </span>
    </span>
  )
}
