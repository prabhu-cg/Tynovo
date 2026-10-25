import { canRedo, canUndo, COALESCE_MS, commit, createHistory, endGesture, HISTORY_LIMIT, live, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes whole steps, and a new commit clears the redo branch', () => {
    let h = createHistory(0)
    h = commit(h, 1, 0)
    h = commit(h, 2, 10)
    expect(h.present).toBe(2)
    h = undo(h)
    expect([h.present, canRedo(h)]).toEqual([1, true])
    h = redo(h)
    expect(h.present).toBe(2)
    h = undo(undo(h))
    expect([h.present, canUndo(h)]).toEqual([0, false])
    h = commit(h, 9, 20)
    expect(canRedo(h)).toBe(false)
  })
  it('undo and redo at the ends do nothing', () => {
    const h = createHistory('a')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
  it('ignores a commit that changes nothing', () => {
    const h = createHistory(5)
    expect(commit(h, 5, 0)).toBe(h)
  })
  it('coalesces repeated edits with the same key into one step, but not after a pause or a different key', () => {
    let h = createHistory(0)
    h = commit(h, 1, 0, 'nudge')
    h = commit(h, 2, 100, 'nudge')
    h = commit(h, 3, 200, 'nudge')
    expect(h.past).toEqual([0]) // one step
    h = commit(h, 4, 200 + COALESCE_MS + 1, 'nudge')
    expect(h.past).toEqual([0, 3])
    h = commit(h, 5, 200 + COALESCE_MS + 2, 'other')
    expect(h.past).toEqual([0, 3, 4])
  })
  it('a gesture is one step no matter how many live updates it made, and none if it ends where it began', () => {
    let h = createHistory(10)
    const base = h.present
    for (const v of [11, 12, 13]) h = live(h, v)
    expect(h.past).toEqual([])
    h = endGesture(h, base, Object.is, 0)
    expect([h.past, h.present]).toEqual([[10], 13])
    let g = createHistory(10)
    g = live(g, 11)
    g = live(g, 10)
    g = endGesture(g, 10, Object.is, 0)
    expect(g.past).toEqual([])
  })
  it('keeps a bounded past', () => {
    let h = createHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = commit(h, i, i * 10_000)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(50) // the oldest 50 of states 0..249 were dropped
  })
})
