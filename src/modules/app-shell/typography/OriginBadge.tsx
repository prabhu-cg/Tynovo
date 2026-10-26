import { ORIGIN_LABEL, type FontOrigin } from '@/modules/brand-system/fonts'
import { AlertIcon, CustomFontIcon, ExistingFontIcon } from '@/modules/shared-ui'

/**
 * Says which kind of font a role uses. The custom typeface is filled and carries a pen; an existing font is
 * outlined and carries a shelf. Words always say it too, so colour is never the only signal.
 */
export function OriginBadge({ origin }: { origin: FontOrigin }) {
  if (origin === 'custom') {
    return <span data-origin="custom" className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-accent-strong"><CustomFontIcon />{ORIGIN_LABEL.custom}</span>
  }
  if (origin === 'catalog' || origin === 'system' || origin === 'uploaded') {
    return <span data-origin={origin} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-ink"><ExistingFontIcon />{ORIGIN_LABEL[origin]}</span>
  }
  if (origin === 'broken') {
    return <span data-origin="broken" className="inline-flex items-center gap-1.5 rounded-full border border-danger px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-danger"><AlertIcon />{ORIGIN_LABEL.broken}</span>
  }
  return <span data-origin="none" className="inline-flex items-center rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-soft">{ORIGIN_LABEL.none}</span>
}
