import type { SVGProps } from 'react'

/** One small stroke icon set (20px grid, 1.75 stroke, round caps) so toolbar controls read as a family. */
function Icon({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  )
}

export const UndoIcon = () => <Icon><path d="M7.5 4.5 3.5 8.5l4 4" /><path d="M4 8.5h7a5 5 0 0 1 0 10H8" /></Icon>
export const RedoIcon = () => <Icon><path d="m12.5 4.5 4 4-4 4" /><path d="M16 8.5H9a5 5 0 0 0 0 10h3" /></Icon>
export const ZoomInIcon = () => <Icon><circle cx="8.5" cy="8.5" r="5.5" /><path d="m17 17-4.6-4.6M8.5 6v5M6 8.5h5" /></Icon>
export const ZoomOutIcon = () => <Icon><circle cx="8.5" cy="8.5" r="5.5" /><path d="m17 17-4.6-4.6M6 8.5h5" /></Icon>
export const FitIcon = () => <Icon><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></Icon>
export const PointerIcon = () => <Icon><path d="M5 3v12l3.2-3 2.3 5 2-1-2.3-4.8H14z" /></Icon>
export const HandIcon = () => <Icon><path d="M7 10V4.5a1.2 1.2 0 0 1 2.4 0V9m0-1.5V3.5a1.2 1.2 0 0 1 2.4 0V9m0-4a1.2 1.2 0 0 1 2.4 0v5m0-3a1.2 1.2 0 0 1 2.4 0v4.5c0 3-2 5-5 5h-1.3c-1.8 0-2.7-.7-3.7-2L4.4 12a1.3 1.3 0 0 1 2-1.6L7 11" /></Icon>
export const AddPointIcon = () => <Icon><path d="M3 15 8 5l5 6 4-3" /><circle cx="8" cy="5" r="1.2" fill="currentColor" /><path d="M14.5 14.5v4M12.5 16.5h4" /></Icon>
export const DeletePointIcon = () => <Icon><path d="M3 15 8 5l5 6 4-3" /><circle cx="8" cy="5" r="1.2" fill="currentColor" /><path d="M12.5 16.5h4" /></Icon>
export const ChevronLeftIcon = () => <Icon><path d="m12 4-6 6 6 6" /></Icon>
export const ChevronRightIcon = () => <Icon><path d="m8 4 6 6-6 6" /></Icon>
export const GuidesIcon = () => <Icon><path d="M2.5 6h15M2.5 11h15M2.5 15.5h15" strokeDasharray="2 2.4" /><path d="M6 3v14" /></Icon>
export const GhostIcon = () => <Icon><path d="M5 17V9a5 5 0 0 1 10 0v8l-2.5-1.8L10 17l-2.5-1.8z" strokeDasharray="2.2 2" /></Icon>
export const ResetIcon = () => <Icon><path d="M4 10a6 6 0 1 0 2-4.5" /><path d="M3.5 3.5v3.8h3.8" /></Icon>
export const CheckIcon = () => <Icon><path d="m4 10.5 4 4 8-9" /></Icon>
export const AlertIcon = () => <Icon><path d="M10 3 2.5 16.5h15z" /><path d="M10 8.5v3.5M10 14.3v.2" /></Icon>
export const InfoIcon = () => <Icon><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 6.3v.2" /></Icon>
/** A drawn letter with a pen point: the project's own typeface. */
export const CustomFontIcon = () => <Icon><path d="M3.5 16 8 4.5 12.5 16M5.2 12h5.6" /><path d="m14 8 3 3-4.5 4.5-3.2.5.5-3.2z" /></Icon>
/** A shelf of books: a font made by someone else. */
export const ExistingFontIcon = () => <Icon><path d="M4 3.5h3v13H4zM8.5 3.5h3v13h-3z" /><path d="m13 5 2.8-.7 2.7 11.2-2.8.7z" /></Icon>
export const DownloadIcon = () => <Icon><path d="M10 3.5v9M6.2 9 10 12.8 13.8 9M4 16.5h12" /></Icon>
export const SaveIcon = () => <Icon><path d="M4 3.5h9l3 3v10H4zM7 3.5v4h5v-4M7 16.5v-5h6v5" /></Icon>
