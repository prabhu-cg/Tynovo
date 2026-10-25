import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '@/modules/brand-projects/schema'
import type { ProjectService } from '@/modules/brand-projects/service'
import { StorageError } from '@/modules/persistence/types'
import { describeError } from './errors'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'invalid'
export type LoadState = 'loading' | 'ready' | 'missing' | 'failed'

export const AUTOSAVE_DELAY_MS = 1200

/** Compare content only: updatedAt changes on every save and must not count as an edit. */
const content = (p: Project) => JSON.stringify({ ...p, updatedAt: '' })

export interface ProjectEditor {
  load: LoadState
  loadError: string | null
  draft: Project | null
  state: SaveState
  error: string | null
  lastSavedAt: Date | null
  /** Apply an edit to the draft and schedule an autosave. */
  patch: (fn: (p: Project) => Project) => void
  /** Save now. Resolves true when the draft is stored (or already was). */
  flush: () => Promise<boolean>
  /** Discard the draft and reload what is stored. */
  reload: () => Promise<void>
}

/**
 * Loads one project and keeps a draft that autosaves after a short pause.
 * Saves are compare-and-put: if another tab changed the project, saving stops and says so
 * instead of overwriting. Edits made during a save are saved by the next round, never dropped.
 */
export function useProjectEditor(service: ProjectService, projectId: string, delayMs = AUTOSAVE_DELAY_MS): ProjectEditor {
  const [load, setLoad] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Project | null>(null)
  const [state, setState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const draftRef = useRef<Project | null>(null)
  const savedRef = useRef<Project | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const alive = useRef(true)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const reload = useCallback(async () => {
    clearTimer()
    try {
      const p = await service.get(projectId)
      if (!alive.current) return
      if (!p) {
        setLoad('missing')
        return
      }
      savedRef.current = p
      draftRef.current = p
      setDraft(p)
      setState('saved')
      setError(null)
      setLoadError(null)
      setLoad('ready')
    } catch (e) {
      if (!alive.current) return
      setLoadError(describeError(e))
      setLoad('failed')
    }
  }, [service, projectId])

  const runSave = useCallback(async (): Promise<boolean> => {
    while (true) {
      const d = draftRef.current
      const s = savedRef.current
      if (!d || !s) return true
      if (content(d) === content(s)) {
        if (alive.current) setState('saved')
        return true
      }
      if (d.name.trim() === '') {
        if (alive.current) {
          setState('invalid')
          setError('A project needs a name before it can be saved.')
        }
        return false
      }
      if (alive.current) setState('saving')
      try {
        const next = await service.save(d, s.updatedAt)
        savedRef.current = next
        if (alive.current) {
          setLastSavedAt(new Date())
          setError(null)
        }
        // If the user kept typing while we saved, loop and save that too.
        if (draftRef.current === d) {
          if (alive.current) setState('saved')
          return true
        }
      } catch (e) {
        if (alive.current) {
          setState(e instanceof StorageError && e.code === 'conflict' ? 'conflict' : 'error')
          setError(describeError(e))
        }
        return false
      }
    }
  }, [service])

  const flush = useCallback(function flushNow(): Promise<boolean> {
    clearTimer()
    if (!inFlight.current) {
      inFlight.current = runSave().finally(() => {
        inFlight.current = null
      })
      return inFlight.current
    }
    // A save is running: wait for it, then make sure the latest edits are stored as well.
    return inFlight.current.then(() => flushNow())
  }, [runSave])

  const patch = useCallback(
    (fn: (p: Project) => Project) => {
      const current = draftRef.current
      if (!current) return
      const next = fn(current)
      if (next === current) return
      draftRef.current = next
      setDraft(next)
      setState((s) => (s === 'conflict' ? s : 'dirty'))
      clearTimer()
      timer.current = setTimeout(() => void flush(), delayMs)
    },
    [delayMs, flush],
  )

  useEffect(() => {
    alive.current = true
    void reload()
    return () => {
      alive.current = false
      clearTimer()
    }
  }, [reload])

  // Best effort: store pending edits when the tab is hidden (switching apps, closing on mobile).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  return { load, loadError, draft, state, error, lastSavedAt, patch, flush, reload }
}
