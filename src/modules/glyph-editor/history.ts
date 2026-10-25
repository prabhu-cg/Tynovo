/**
 * Undo / redo over immutable snapshots. Pure: time is passed in, nothing is read from the clock.
 *
 * Three ways to change the present:
 *  - `commit`   one undo step.
 *  - `live`     replace the present without a step (a drag in progress). `endGesture` then records one step.
 *  - `commit` with a `coalesce` key: repeated edits with the same key within `COALESCE_MS` share one step
 *    (holding an arrow key nudges many times but undoes in one go).
 */
export const HISTORY_LIMIT = 200
export const COALESCE_MS = 700

export interface History<T> {
  past: readonly T[]
  present: T
  future: readonly T[]
  lastKey: string | null
  lastAt: number
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null, lastAt: 0 })

const cap = <T>(past: readonly T[]) => (past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past)

export function commit<T>(h: History<T>, next: T, now: number, coalesce?: string): History<T> {
  if (Object.is(next, h.present)) return h
  if (coalesce && h.lastKey === coalesce && now - h.lastAt <= COALESCE_MS && h.past.length > 0) {
    return { ...h, present: next, future: [], lastAt: now }
  }
  return { past: cap([...h.past, h.present]), present: next, future: [], lastKey: coalesce ?? null, lastAt: now }
}

/** Change the present without recording a step. Pair with `endGesture`. */
export const live = <T>(h: History<T>, next: T): History<T> => (Object.is(next, h.present) ? h : { ...h, present: next })

/** Finish a gesture that began at `base`: one undo step back to `base`, or nothing if nothing changed. */
export function endGesture<T>(h: History<T>, base: T, equal: (a: T, b: T) => boolean, now: number): History<T> {
  if (equal(h.present, base)) return { ...h, present: base }
  return { past: cap([...h.past, base]), present: h.present, future: [], lastKey: null, lastAt: now }
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1]
  if (h.past.length === 0 || prev === undefined) return h
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 }
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0]
  if (h.future.length === 0 || next === undefined) return h
  return { past: cap([...h.past, h.present]), present: next, future: h.future.slice(1), lastKey: null, lastAt: 0 }
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0
export const canRedo = <T>(h: History<T>) => h.future.length > 0
