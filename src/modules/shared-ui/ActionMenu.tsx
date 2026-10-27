import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckIcon, MoreIcon } from './icons'

export interface MenuItem {
  id: string
  label: string
  /** A button item. */
  onSelect?: () => void
  /** A link item (navigates instead of acting). */
  to?: string
  danger?: boolean
  /** Extra words for assistive technology only, e.g. which project the item acts on. */
  srSuffix?: string
  /** Makes the item a choice (menuitemradio): true marks the current one, false the others. */
  checked?: boolean
}

const item = 'flex min-h-11 w-full cursor-pointer items-center rounded-sm px-3 text-left text-sm font-semibold whitespace-nowrap hover:bg-sheet-deep focus-visible:bg-sheet-deep md:min-h-9'

/**
 * A "more actions" menu: a button that opens a short list of actions. Keyboard: Enter, Space or Arrow Down opens it
 * and focuses the first action; Arrow Up and Down, Home and End move; Escape closes and returns to the button;
 * Tab leaves. Clicking elsewhere closes it. Every action is also a real button or link, so it works without a mouse.
 */
export function ActionMenu({ label, items, icon, text, align = 'right' }: { label: string; items: readonly MenuItem[]; icon?: ReactNode; /** Shows this beside the icon, as a labelled button (for a menu that displays its current choice). */ text?: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const entries = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]') ?? [])]
  const focusAt = (i: number) => {
    const list = entries()
    list[(i + list.length) % list.length]?.focus()
  }

  useEffect(() => {
    if (!open) return
    focusAt(0)
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  return (
    <div ref={root} className="relative" onKeyDown={(e) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation()
        close(true)
      }
    }}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={text === undefined
          ? 'inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-ink transition-colors hover:bg-sheet-deep aria-expanded:bg-sheet-deep md:size-9'
          : 'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm font-semibold whitespace-nowrap text-ink-strong transition-colors hover:border-ink hover:bg-sheet aria-expanded:bg-sheet md:min-h-9'}
      >
        {icon ?? <MoreIcon />}
        {text}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} z-20 mt-1 grid min-w-52 gap-0.5 rounded-md border border-line-strong bg-paper p-1 shadow-(--shadow-lift)`}
          onKeyDown={(e) => {
            const list = entries()
            const at = list.indexOf(document.activeElement as HTMLElement)
            const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null
            if (to !== null) {
              e.preventDefault()
              focusAt(to)
            } else if (e.key === 'Tab') setOpen(false)
          }}
        >
          {items.map((it) =>
            it.to ? (
              <Link key={it.id} role="menuitem" tabIndex={-1} to={it.to} onClick={() => setOpen(false)} className={`${item} ${it.danger ? 'text-danger' : 'text-ink-strong'}`}>
                {it.label}{it.srSuffix ? <span className="sr-only"> {it.srSuffix}</span> : null}
              </Link>
            ) : (
              <button
                key={it.id}
                type="button"
                role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={it.checked}
                tabIndex={-1}
                onClick={() => {
                  // Focus goes back to the menu button first, so it is never lost to the page when the menu unmounts, and so
                  // whatever the action opens (a modal, an autofocused field) knows what to hand focus back to.
                  close(true)
                  it.onSelect?.()
                }}
                className={`${item} ${it.danger ? 'text-danger' : 'text-ink-strong'}`}
              >
                {it.checked === undefined ? null : <span aria-hidden="true" className="mr-2 inline-flex w-[18px] shrink-0 text-accent-text">{it.checked ? <CheckIcon /> : null}</span>}
                {it.label}{it.srSuffix ? <span className="sr-only"> {it.srSuffix}</span> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}
