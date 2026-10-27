import { useEffect, useState } from 'react'

/**
 * Keeps an overlay in the DOM long enough to animate out. `mounted` is whether to render it; `closing` is true during the
 * exit, when it should play its exit animation and be inert. Opening again mid-exit just reopens it.
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; closing: boolean } {
  const [prevOpen, setPrevOpen] = useState(open)
  const [exiting, setExiting] = useState(false)
  if (open !== prevOpen) {
    // Adjusting state while rendering, from the previous render's value: React's documented pattern, no extra commit.
    setPrevOpen(open)
    setExiting(!open)
  }
  useEffect(() => {
    if (!exiting) return
    const t = setTimeout(() => setExiting(false), exitMs)
    return () => clearTimeout(t)
  }, [exiting, exitMs])
  return { mounted: open || exiting, closing: exiting && !open }
}
