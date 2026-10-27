import { useEffect, useRef } from 'react'

/** Marks a floating layer (drawer, modal) so focus tracking does not mistake its controls for the opener. */
export const LAYER_SELECTOR = '[data-drawer],[data-modal]'

/**
 * Make everything outside `keep` inert (unreachable by Tab, click or assistive technology) and return the undo.
 * Walks up from `keep` to the body and marks each ancestor's other children, so it needs no portal.
 */
export function isolate(keep: HTMLElement): () => void {
  const marked: Element[] = []
  for (let node: HTMLElement | null = keep; node?.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue
      sibling.setAttribute('inert', '')
      marked.push(sibling)
    }
  }
  return () => marked.forEach((el) => el.removeAttribute('inert'))
}

/**
 * Give focus back to whatever opened a layer when it closes. The opener is the last element outside any layer to lose
 * focus: recorded on `focusout` because a field inside the layer may autofocus during the commit, so by the time an
 * effect runs document.activeElement is already that field. Call this AFTER the effect that calls `isolate`, so the
 * page is no longer inert when focus returns (effect cleanups run in declaration order).
 */
export function useReturnFocus(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const remember = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && !e.target.closest(LAYER_SELECTOR)) opener.current = e.target
    }
    document.addEventListener('focusout', remember)
    return () => document.removeEventListener('focusout', remember)
  }, [])
  useEffect(() => {
    if (!open) return
    return () => {
      const back = opener.current
      opener.current = null
      if (back?.isConnected) back.focus()
    }
  }, [open])
}
