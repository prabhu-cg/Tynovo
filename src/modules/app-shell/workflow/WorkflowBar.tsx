import { useState } from 'react'
import { useLocation } from 'react-router'
import { activeStepId, nextStep, progressOf, type WorkflowStep } from '@/modules/brand-system/workflow'
import { ArrowRightIcon, AlertIcon, CheckIcon, Drawer, ListIcon } from '@/modules/shared-ui'
import { StepLink } from './StepLink'

const STATE_LABEL: Record<WorkflowStep['state'], string> = { done: 'Done', attention: 'Needs attention', todo: 'To do', optional: 'Optional' }

/** The small round marker of a step: filled and ticked when done, a warning when it needs attention, hollow when to do, dashed when optional. */
function Marker({ state, active }: { state: WorkflowStep['state']; active: boolean }) {
  const look =
    state === 'done' ? 'border-ok bg-ok text-white' : state === 'attention' ? 'border-warn bg-warn-soft text-warn' : state === 'optional' ? 'border-dashed border-line-strong bg-paper text-ink-soft' : 'border-line-strong bg-paper text-ink-soft'
  return (
    <span aria-hidden="true" className={`relative grid size-5 shrink-0 place-items-center rounded-full border text-[0.65rem] leading-none font-bold transition-colors duration-300 ${look} ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}>
      {/* Keyed by state, so when a step becomes done its tick is drawn afresh. */}
      <span key={state} className={state === 'done' || state === 'attention' ? 'step-pop grid place-items-center' : 'contents'}>
        {state === 'done' ? <CheckIcon width={12} height={12} strokeWidth={2.6} /> : state === 'attention' ? <AlertIcon width={11} height={11} strokeWidth={2.4} /> : null}
      </span>
    </span>
  )
}

/**
 * The workflow, on every screen of a project. It sits under the app's top bar and stays there as the page scrolls:
 * where you are in the eight steps, which are done, a jump to any of them, and one button for what to do next.
 * On a phone the steps collapse into "Workflow 3/7" and the same list opens in a side panel.
 */
export function WorkflowBar({ steps, projectId }: { steps: readonly WorkflowStep[]; projectId: string }) {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()
  const sub = pathname.replace(new RegExp(`^/app/projects/${projectId}`), '')
  const active = activeStepId(sub, hash)
  const next = nextStep(steps)
  const { done, total } = progressOf(steps)
  const current = steps.find((s) => s.id === active)

  return (
    <>
    <div data-testid="workflow-bar" className="sticky top-14 z-30 -mx-1 border-b border-line bg-paper/95 px-1 backdrop-blur-sm">
      <div className="flex min-h-12 items-center gap-3 py-1.5">
        <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)} className="group inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm font-semibold text-ink-strong transition-colors hover:border-ink hover:bg-sheet md:min-h-9">
          <ListIcon />
          Workflow
          <span className="tnum rounded-sm bg-sheet-deep px-1.5 py-0.5 text-xs font-bold text-ink-strong">{done}/{total}</span>
        </button>

        <nav aria-label="Workflow steps" className="hidden min-w-0 flex-1 md:block">
          <ol className="flex items-center">
            {steps.map((s, i) => (
              <li key={s.id} data-bar-step={s.id} data-state={s.state} className={`flex items-center ${i === steps.length - 1 ? '' : 'flex-1'}`}>
                <StepLink to={s.to} aria-current={s.id === active ? 'step' : undefined} title={`${s.title}: ${STATE_LABEL[s.state].toLowerCase()}`} className={`group/step inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150 hover:bg-sheet ${s.id === active ? 'text-ink-strong' : 'text-ink-soft hover:text-ink-strong'}`}>
                  <Marker state={s.state} active={s.id === active} />
                  <span className="hidden lg:inline">{s.short}</span>
                  <span className="sr-only lg:hidden">{s.title}, </span>
                  <span className="sr-only">{STATE_LABEL[s.state]}</span>
                </StepLink>
                {i === steps.length - 1 ? null : (
                  <span aria-hidden="true" className="relative mx-0.5 h-px min-w-3 flex-1 bg-line">
                    <span className={`absolute inset-0 origin-left bg-ok transition-transform duration-500 ease-[var(--ease-out-expo)] ${s.state === 'done' ? 'scale-x-100' : 'scale-x-0'}`} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft md:hidden">{current ? <>Step: <span className="font-semibold text-ink-strong">{current.short}</span></> : 'Project'}</p>

        {next ? (
          <StepLink to={next.to} data-testid="workflow-next" className="group/next inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover md:min-h-9">
            <span className="hidden sm:inline">Next:</span> {next.short}
            <span className="transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/next:translate-x-0.5"><ArrowRightIcon /></span>
          </StepLink>
        ) : (
          <StepLink to="export" data-testid="workflow-next" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-ok px-3 text-sm font-semibold text-ok md:min-h-9"><CheckIcon /> All steps done</StepLink>
        )}
      </div>
    </div>

    {/* Outside the bar: its backdrop blur would otherwise make the bar the containing block of this fixed panel and clip it. */}
      <Drawer open={open} title="Workflow" onClose={() => setOpen(false)}>
        <p className="text-sm text-ink-soft">One project, both modes. Work top to bottom, or jump in anywhere: every step opens its own screen or section.</p>
        <ol aria-label="All workflow steps" className="stagger mt-4 divide-y divide-line border-y border-line">
          {steps.map((s, i) => (
            <li key={s.id} data-drawer-step={s.id} data-state={s.state} style={{ ['--i' as string]: i }} className="relative">
              <StepLink to={s.to} onNavigate={() => setOpen(false)} aria-current={s.id === active ? 'step' : undefined} className={`grid gap-0.5 py-3 pr-2 pl-9 transition-colors duration-150 hover:bg-sheet focus-visible:bg-sheet ${s.id === active ? 'bg-accent-wash/60' : ''}`}>
                <span className="absolute top-3.5 left-2"><Marker state={s.state} active={s.id === active} /></span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink-strong">{s.title}</span>
                  <span className={`text-xs font-bold uppercase ${s.state === 'done' ? 'text-ok' : s.state === 'attention' ? 'text-warn' : 'text-ink-soft'}`}>{STATE_LABEL[s.state]}</span>
                </span>
                <span className="text-sm text-ink-soft">{s.detail}</span>
              </StepLink>
            </li>
          ))}
        </ol>
      </Drawer>
    </>
  )
}
