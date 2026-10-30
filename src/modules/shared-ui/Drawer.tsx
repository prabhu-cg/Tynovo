import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { isolate, useReturnFocus } from './focus'
import { usePresence } from './presence'

/** At or below this width the drawer covers (nearly) the whole page, so the page behind must not take focus. */
const COVERS_PAGE = '(max-width: 640px)'

/**
 * Side panel. The page behind is dimmed by a scrim; pressing the scrim (or anywhere outside) closes it. On a narrow screen it
 * covers the page, so the page is made inert while it is open. Escape closes it; focus moves in on open (to a field
 * that asked for focus, otherwise to the panel) and back to the opener on close.
 */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const { mounted, closing } = usePresence(open, 230) // long enough for the exit animation in index.css (220ms)

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
  // Pressing anywhere outside closes it. Its opener is left alone (aria-expanded, or data-drawer-opener for a list of things that each open it), as is anything in a dialog on top.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Element) || ref.current?.contains(t)) return
      if (t.closest('[aria-expanded="true"], [role="dialog"], [role="alertdialog"], [data-drawer], [data-drawer-opener]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onClose])
  useReturnFocus(open) // after the effect above: the page must not be inert when focus goes back

  if (!mounted) return null
  return (
    <>
    <div aria-hidden="true" data-fade data-closing={closing || undefined} className="modal-scrim fixed inset-0 z-[45] bg-black/40" />
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      data-drawer
      data-fade
      data-closing={closing || undefined}
      inert={closing || undefined}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="drawer-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-(--shadow-drawer) outline-none"
    >
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-bold">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>Close</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
    </>
  )
}
