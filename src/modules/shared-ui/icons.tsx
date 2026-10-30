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
export const CurveIcon = () => <Icon><path d="M3 16C3 6 14 4 17 4" /><rect x="1.8" y="14.8" width="2.4" height="2.4" fill="currentColor" stroke="none" /><rect x="15.8" y="2.8" width="2.4" height="2.4" fill="currentColor" stroke="none" /><circle cx="3.5" cy="4.5" r="1.4" /></Icon>
export const FitCurvesIcon = () => <Icon><path d="M3 15c2-1 2.5-4 4-6s4-3 6-3 3 .5 4 1" /><path d="M3 15l1.5-2.2M6 9.5 7 8M10 6.8 11.5 6.2M14 6.8l2.5 1" strokeDasharray="1.4 1.8" /></Icon>
export const StraightenIcon = () => <Icon><path d="M3.5 16.5 16.5 3.5" /><rect x="2.3" y="15.3" width="2.4" height="2.4" fill="currentColor" stroke="none" /><rect x="15.3" y="2.3" width="2.4" height="2.4" fill="currentColor" stroke="none" /></Icon>
export const SmoothIcon = () => <Icon><path d="M2.5 13.5c3-7 6-7 7.5-3.5s4.5 3.5 7.5-3" /><path d="M5 7.5h10" strokeDasharray="2 2" /><circle cx="10" cy="10" r="1.3" fill="currentColor" /></Icon>
export const ListIcon = () => <Icon><path d="M7 5.5h10M7 10h10M7 14.5h10" /><circle cx="3.5" cy="5.5" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="14.5" r="1" fill="currentColor" stroke="none" /></Icon>
export const ChevronLeftIcon = () => <Icon><path d="m12 4-6 6 6 6" /></Icon>
export const ChevronRightIcon = () => <Icon><path d="m8 4 6 6-6 6" /></Icon>
export const GuidesIcon = () => <Icon><path d="M2.5 6h15M2.5 11h15M2.5 15.5h15" strokeDasharray="2 2.4" /><path d="M6 3v14" /></Icon>
export const GhostIcon = () => <Icon><path d="M5 17V9a5 5 0 0 1 10 0v8l-2.5-1.8L10 17l-2.5-1.8z" strokeDasharray="2.2 2" /></Icon>
export const ResetIcon = () => <Icon><path d="M4 10a6 6 0 1 0 2-4.5" /><path d="M3.5 3.5v3.8h3.8" /></Icon>
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m4 10.5 4 4 8-9" /></Icon>
export const AlertIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M10 3 2.5 16.5h15z" /><path d="M10 8.5v3.5M10 14.3v.2" /></Icon>
export const InfoIcon = () => <Icon><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 6.3v.2" /></Icon>
/** A drawn letter with a pen point: the project's own typeface. */
export const CustomFontIcon = () => <Icon><path d="M3.5 16 8 4.5 12.5 16M5.2 12h5.6" /><path d="m14 8 3 3-4.5 4.5-3.2.5.5-3.2z" /></Icon>
/** A shelf of books: a font made by someone else. */
export const ExistingFontIcon = () => <Icon><path d="M4 3.5h3v13H4zM8.5 3.5h3v13h-3z" /><path d="m13 5 2.8-.7 2.7 11.2-2.8.7z" /></Icon>
export const DownloadIcon = () => <Icon><path d="M10 3.5v9M6.2 9 10 12.8 13.8 9M4 16.5h12" /></Icon>
export const SaveIcon = () => <Icon><path d="M4 3.5h9l3 3v10H4zM7 3.5v4h5v-4M7 16.5v-5h6v5" /></Icon>
export const LockIcon = () => <Icon><rect x="4.5" y="9" width="11" height="8" rx="1.8" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></Icon>
export const MoreIcon = () => <Icon><circle cx="10" cy="4.5" r="1.1" fill="currentColor" /><circle cx="10" cy="10" r="1.1" fill="currentColor" /><circle cx="10" cy="15.5" r="1.1" fill="currentColor" /></Icon>

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M3 5.5h14M3 10h14M3 14.5h14" /></Icon>
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m5 5 10 10M15 5 5 15" /></Icon>
export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M4 10h12m-5-5 5 5-5 5" /></Icon>
export const BookIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M3.5 4.5c2.6-.8 4.9-.6 6.5.9 1.6-1.5 3.9-1.7 6.5-.9v10.8c-2.6-.8-4.9-.6-6.5.9-1.6-1.5-3.9-1.7-6.5-.9z" /><path d="M10 5.4v10.8" /></Icon>
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m5 7.5 5 5 5-5" /></Icon>
export const SunIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="10" cy="10" r="3.4" /><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M15.3 4.7 14 6M6 14l-1.3 1.3" /></Icon>
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M16.5 11.6A6.6 6.6 0 0 1 8.4 3.5a6.6 6.6 0 1 0 8.1 8.1z" /></Icon>
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="8.6" cy="8.6" r="5.2" /><path d="m12.5 12.5 4.2 4.2" /></Icon>
export const SlidersIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" /><circle cx="13" cy="5.5" r="2" /><circle cx="7" cy="14.5" r="2" /></Icon>
export const SortIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M6.5 16V4M3.5 7l3-3 3 3M13.5 4v12M10.5 13l3 3 3-3" /></Icon>
