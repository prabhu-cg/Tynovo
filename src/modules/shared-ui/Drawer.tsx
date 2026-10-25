import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

/**
 * Non-modal side panel: the page behind stays readable and interactive.
 * Escape closes it; focus moves in on open and back to the opener on close.
 */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => opener?.focus?.()
  }, [open])
  if (!open) return null
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-(--shadow-drawer) outline-none animate-[drawer-in_260ms_var(--ease-out-expo)]"
    >
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-bold">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>Close</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  )
}
