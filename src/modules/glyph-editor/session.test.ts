import type { Contour } from '@/modules/brand-projects/schema'
import { pointKey } from './outline'
import { draftOf, isDirty, openSession, reduce, type Draft } from './session'

const sq: Contour = [{ x: 0, y: 0, onCurve: true }, { x: 0, y: 100, onCurve: true }, { x: 100, y: 100, onCurve: true }, { x: 100, y: 0, onCurve: true }]
const start: Draft = { contours: [sq], advanceWidth: 160 }
const moved = (dx: number): Draft => ({ contours: [sq.map((p, i) => (i === 0 ? { ...p, x: p.x + dx } : p))], advanceWidth: 160 })

describe('glyph editing session', () => {
  it('starts clean and becomes dirty only when the working copy differs from what was applied', () => {
    let s = openSession('H', start)
    expect(isDirty(s)).toBe(false)
    s = reduce(s, { type: 'commit', draft: moved(5), now: 0 })
    expect(isDirty(s)).toBe(true)
    s = reduce(s, { type: 'undo' })
    expect(isDirty(s)).toBe(false)
    s = reduce(s, { type: 'redo' })
    s = reduce(s, { type: 'applied', draft: draftOf(s) })
    expect(isDirty(s)).toBe(false)
    s = reduce(s, { type: 'undo' })
    expect(isDirty(s)).toBe(true) // undoing past the applied state is an unsaved change again
  })
  it('a drag is live until it ends, then is a single undo step', () => {
    let s = openSession('H', start)
    for (const dx of [1, 2, 3]) s = reduce(s, { type: 'live', draft: moved(dx) })
    s = reduce(s, { type: 'endGesture', base: start, now: 0 })
    expect(draftOf(s)).toEqual(moved(3))
    s = reduce(s, { type: 'undo' })
    expect(draftOf(s)).toEqual(start)
  })
  it('revert goes back to the applied state and can itself be undone', () => {
    let s = openSession('H', start)
    s = reduce(s, { type: 'commit', draft: moved(9), now: 0 })
    s = reduce(s, { type: 'revert', now: 1 })
    expect(draftOf(s)).toEqual(start)
    s = reduce(s, { type: 'undo' })
    expect(draftOf(s)).toEqual(moved(9))
  })
  it('drops a selection that no longer exists after undo', () => {
    let s = openSession('H', start)
    const withExtra: Draft = { contours: [[...sq, { x: 50, y: -10, onCurve: true }]], advanceWidth: 160 }
    s = reduce(s, { type: 'commit', draft: withExtra, now: 0, selection: new Set([pointKey(0, 4)]) })
    expect(s.selection.has('0:4')).toBe(true)
    s = reduce(s, { type: 'undo' })
    expect(s.selection.size).toBe(0)
  })
  it('reload starts a fresh session', () => {
    let s = openSession('H', start)
    s = reduce(s, { type: 'commit', draft: moved(2), now: 0 })
    s = reduce(s, { type: 'reload', draft: moved(7) })
    expect(isDirty(s)).toBe(false)
    expect(s.history.past).toHaveLength(0)
  })
})
