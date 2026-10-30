import { progressOf, type WorkflowStep } from '@/modules/brand-system/workflow'

/** "3 of 7 steps done" with a bar that fills from the left once when the page opens, and eases to a new value as steps are done. */
export function Progress({ steps }: { steps: readonly WorkflowStep[] }) {
  const { done, total } = progressOf(steps)
  return (
    <div data-testid="workflow-progress" className="flex min-w-0 items-center gap-3">
      <div role="progressbar" aria-label="Workflow progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} of ${total} steps done`} className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-line sm:w-40">
        <div className="progress-fill h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
      </div>
      <p className="tnum text-sm text-ink-soft"><span className="font-semibold text-ink-strong">{done} of {total}</span> steps done</p>
    </div>
  )
}
