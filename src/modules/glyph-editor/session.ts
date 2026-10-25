import type { Contour } from '@/modules/brand-projects/schema'
import * as H from './history'
import { EMPTY_SELECTION, sameContours, validSelection, type Selection } from './outline'

/**
 * One editing session on one glyph: the working copy, its undo history, what is selected, and what was last
 * applied to the project. "Unsaved" means the working copy differs from the applied one.
 */
export interface Draft {
  contours: Contour[]
  advanceWidth: number
}

export const sameDraft = (a: Draft, b: Draft) => a.advanceWidth === b.advanceWidth && sameContours(a.contours, b.contours)

export interface Session {
  char: string
  history: H.History<Draft>
  /** What the project holds right now for this glyph. */
  applied: Draft
  selection: Selection
}

export const openSession = (char: string, draft: Draft): Session => ({ char, history: H.createHistory(draft), applied: draft, selection: EMPTY_SELECTION })

export const draftOf = (s: Session) => s.history.present
export const isDirty = (s: Session) => !sameDraft(s.history.present, s.applied)

export type Action =
  | { type: 'commit'; draft: Draft; now: number; coalesce?: string; selection?: Selection }
  | { type: 'live'; draft: Draft }
  | { type: 'endGesture'; base: Draft; now: number }
  | { type: 'select'; selection: Selection }
  | { type: 'undo' }
  | { type: 'redo' }
  /** The working copy was applied to the project. */
  | { type: 'applied'; draft: Draft }
  /** Throw away unapplied work: back to what the project holds. This is itself one undo step. */
  | { type: 'revert'; now: number }
  /** The project changed under the editor (reset to generated, restore): adopt the new state as a fresh start. */
  | { type: 'reload'; draft: Draft }

const fit = (s: Session, selection: Selection): Session => ({ ...s, selection: validSelection(s.history.present.contours, selection) })

export function reduce(s: Session, a: Action): Session {
  switch (a.type) {
    case 'commit': {
      const history = H.commit(s.history, a.draft, a.now, a.coalesce)
      return fit({ ...s, history }, a.selection ?? s.selection)
    }
    case 'live':
      return { ...s, history: H.live(s.history, a.draft) }
    case 'endGesture':
      return fit({ ...s, history: H.endGesture(s.history, a.base, sameDraft, a.now) }, s.selection)
    case 'select':
      return fit(s, a.selection)
    case 'undo':
      return fit({ ...s, history: H.undo(s.history) }, s.selection)
    case 'redo':
      return fit({ ...s, history: H.redo(s.history) }, s.selection)
    case 'applied':
      return { ...s, applied: a.draft }
    case 'revert':
      return fit({ ...s, history: H.commit(s.history, s.applied, a.now) }, s.selection)
    case 'reload':
      return { ...openSession(s.char, a.draft), selection: EMPTY_SELECTION }
  }
}
