import { useEffect } from 'react'

/**
 * Side panels (Workflow, Help) all open over the same edge, so only one may be open at a time: opening one tells the
 * others, which close. Nothing else is shared between them.
 */
const EVENT = 'tynovo:panel'

export function announcePanel(id: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

/** Close this panel when another one announces that it opened. */
export function useCloseWhenOtherOpens(id: string, close: () => void): void {
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) close()
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [id, close])
}
