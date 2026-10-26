import type { ReactNode } from 'react'
import { useProject } from './project'

/**
 * Wraps controls that change the project. In a read-only project (the sample) every form control inside is
 * disabled, which also removes them from the tab order but keeps them readable by assistive technology.
 * Links, tabs, `details` and anything that only changes what is shown (previews, filters) stay live, so the
 * sample can still be explored. A refusal in `editor.patch` backs this up for anything that is missed.
 */
export function EditGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { readOnly } = useProject()
  return (
    <fieldset disabled={readOnly} className={`m-0 block min-w-0 border-0 p-0 ${className}`}>
      {children}
    </fieldset>
  )
}
