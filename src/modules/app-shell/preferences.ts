import { useEffect, useState } from 'react'

/**
 * Display preferences kept in this browser. The only one today is whether the sample project on the Projects page is
 * collapsed. It is a single value in localStorage (never sent anywhere, and not part of any project). If the browser
 * blocks storage, the choice still holds for the rest of the visit, from memory, and is simply not remembered after it.
 */
export const SAMPLE_COLLAPSED_KEY = 'tynovo.sampleCollapsed'

let remembered: boolean | null = null

function read(): boolean {
  try {
    const v = localStorage.getItem(SAMPLE_COLLAPSED_KEY)
    if (v === '1' || v === '0') return v === '1'
  } catch {
    /* storage blocked: fall through to memory */
  }
  return remembered ?? false
}

function write(collapsed: boolean): void {
  remembered = collapsed
  try {
    localStorage.setItem(SAMPLE_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* storage blocked or full: the choice lives in memory for this visit */
  }
}

/** Whether the sample is collapsed, and a setter that remembers the choice. Follows a change made in another tab. */
export function useSampleCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(read)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAMPLE_COLLAPSED_KEY) setCollapsed(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return [collapsed, (next) => { write(next); setCollapsed(next) }]
}
