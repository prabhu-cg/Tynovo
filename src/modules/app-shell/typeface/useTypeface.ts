import { useCallback, useRef } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { checkpoint, type Stamp } from '@/modules/typeface-engine/edit'
import { useProject } from '../project'

export const newStamp = (): Stamp => ({ id: crypto.randomUUID(), at: new Date().toISOString() })

export interface TypefaceHandle {
  face: CustomTypeface
  /** Apply a pure edit from typeface-engine/edit to the project's typeface. */
  update: (fn: (f: CustomTypeface) => CustomTypeface) => void
  /**
   * Like update, but the first design change in this visit first saves a restore point, so there is always
   * a way back to how the design looked when you opened it.
   */
  edit: (fn: (f: CustomTypeface) => CustomTypeface) => void
}

/** Typeface of the current project (the caller guarantees it exists) with edit helpers over the autosaving draft. */
export function useTypeface(face: CustomTypeface): TypefaceHandle {
  const { editor } = useProject()
  const saidBefore = useRef(false)
  const update = useCallback(
    (fn: (f: CustomTypeface) => CustomTypeface) => editor.patch((p) => (p.customTypeface ? { ...p, customTypeface: fn(p.customTypeface) } : p)),
    [editor],
  )
  const edit = useCallback(
    (fn: (f: CustomTypeface) => CustomTypeface) => {
      update((f) => {
        if (saidBefore.current) return fn(f)
        // Remember the design as it was before the first change, then make the change on top of that,
        // so any restore point the change itself adds is kept.
        const opened = checkpoint(f, 'When you opened it', newStamp())
        const next = fn(opened)
        if (next === opened) return f // nothing changed: leave the project untouched
        saidBefore.current = true
        return next
      })
    },
    [update],
  )
  return { face, update, edit }
}
