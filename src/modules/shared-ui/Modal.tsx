import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { isolate, useReturnFocus } from './focus'
import { usePresence } from './presence'

/**
 * A modal dialog, for the few tasks that need an interruption and protected focus (a destructive confirmation).
 * Everything behind it is inert, Escape or a click on the backdrop cancels, focus starts on `initialFocus` (give it the
 * safe choice) or on the dialog, and goes back to the control that opened it. Prefer a drawer for anything else.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  initialFocus,
  children,
}: {
  open: boolean
  title: string
  /** Read out with the title when the dialog opens. */
  description?: string
  onClose: () => void
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const layer = useRef<HTMLDivElement>(null)
  const { mounted, closing } = usePresence(open, 150) // long enough for the exit animation in index.css
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // A click that starts and ends on the backdrop cancels. It must close on `click`, not `mousedown`: the browser moves focus
  // as the default action of mousedown, after any handler, and would undo the focus we hand back to the opener.
  const downOnBackdrop = useRef(false)
  const descId = useId()

  useEffect(() => {
    if (!open || !layer.current) return
    const undo = isolate(layer.current)
    const scroll = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    ;(initialFocus?.current ?? panel.current)?.focus()
    return () => {
      document.documentElement.style.overflow = scroll
      undo()
    }
  }, [open, initialFocus])
  useReturnFocus(open) // after the effect above: the page must not be inert when focus goes back

  if (!mounted) return null
  return (
    <div
      ref={layer}
      data-modal
      data-fade
      data-closing={closing || undefined}
      inert={closing || undefined}
      className="modal-scrim fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose() }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-fade
        data-closing={closing || undefined}
        className="modal-panel max-h-full w-full max-w-md overflow-y-auto rounded-card border border-line bg-paper p-6 shadow-lift outline-none"
      >
        <h2 id={titleId} className="text-lg leading-snug font-bold text-ink-strong">{title}</h2>
        {description ? <p id={descId} className="mt-2 text-sm">{description}</p> : null}
        {children}
      </div>
    </div>
  )
}
