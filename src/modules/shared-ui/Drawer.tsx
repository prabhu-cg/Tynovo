import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { isolate, useReturnFocus } from './focus'

/** At or below this width the drawer covers (nearly) the whole page, so the page behind must not take focus. */
const COVERS_PAGE = '(max-width: 640px)'

/**
 * Side panel. On a wide screen it is non-modal: the page behind stays readable and interactive. On a narrow one it
 * covers the page, so the page is made inert while it is open. Escape closes it; focus moves in on open (to a field
 * that asked for focus, otherwise to the panel) and back to the opener on close.
 */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = ref.current
    if (panel && !panel.contains(document.activeElement)) panel.focus()
    let undo: (() => void) | null = null
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(COVERS_PAGE) : null
    const apply = () => {
      undo?.()
      undo = mq?.matches && panel ? isolate(panel) : null
    }
    apply()
    mq?.addEventListener('change', apply)
    return () => {
      mq?.removeEventListener('change', apply)
      undo?.()
    }
  }, [open])
  useReturnFocus(open) // after the effect above: the page must not be inert when focus goes back

  if (!open) return null
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      data-drawer
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-(--shadow-drawer) outline-none animate-[drawer-in_260ms_var(--ease-out-expo)]"
    >
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-bold">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>Close</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  )
}
