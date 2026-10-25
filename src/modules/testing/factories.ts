import type { Clock } from '@/modules/brand-projects/model'

/** Deterministic clock: ids "id-1", "id-2"… and time advancing one second per call to now(). */
export function fakeClock(start = '2026-01-01T00:00:00.000Z'): Clock {
  let n = 0
  let t = new Date(start).getTime()
  return {
    now: () => new Date((t += 1000)),
    newId: () => `id-${++n}`,
  }
}
