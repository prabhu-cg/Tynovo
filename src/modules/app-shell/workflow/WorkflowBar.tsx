import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import { activeStepId, nextStep, progressOf, type WorkflowStep } from '@/modules/brand-system/workflow'
import { ArrowRightIcon, AlertIcon, CheckIcon, Drawer, ListIcon } from '@/modules/shared-ui'
import { announcePanel, useCloseWhenOtherOpens } from '../panels'
import { StepLink } from './StepLink'

const STATE_LABEL: Record<WorkflowStep['state'], string> = { done: 'Done', attention: 'Needs attention', todo: 'To do', optional: 'Optional' }

/**
 * The round marker of a step. It carries the step's number, so the order reads at a glance: a tick when done, a warning when it
 * needs attention, a dashed ring when optional, solid accent when it is the step you are on, otherwise a plain numbered ring.
 */
function Marker({ state, active, n }: { state: WorkflowStep['state']; active: boolean; n: number }) {
  const look =
    state === 'done'
      ? 'border-ok bg-ok text-white'
      : state === 'attention'
        ? 'border-warn bg-warn-soft text-warn'
        : active
          ? 'border-accent bg-accent text-white'
          : state === 'optional'
            ? 'border-dashed border-line-strong bg-paper text-ink-soft'
            : 'border-line-strong bg-paper text-ink'
  return (
    <span aria-hidden="true" className={`relative grid size-6 shrink-0 place-items-center rounded-full border text-xs leading-none font-bold tabular-nums transition-colors duration-300 ${look} ${active && (state === 'done' || state === 'attention') ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}>
      {/* Keyed by state, so when a step becomes done its tick is drawn afresh. */}
      <span key={state} className={state === 'done' || state === 'attention' ? 'step-pop grid place-items-center' : 'contents'}>
        {state === 'done' ? <CheckIcon width={13} height={13} strokeWidth={2.6} /> : state === 'attention' ? <AlertIcon width={12} height={12} strokeWidth={2.4} /> : n}
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
  const close = useCallback(() => setOpen(false), [])
  useCloseWhenOtherOpens('workflow', close)
  const { pathname, hash } = useLocation()
  const sub = pathname.replace(new RegExp(`^/app/projects/${projectId}`), '')
  const active = activeStepId(sub, hash)
  const next = nextStep(steps)
  const { done, total } = progressOf(steps)
  
  return (
    <>
    <div data-testid="workflow-bar" className="sticky top-14 z-30 -mx-1 border-b border-line bg-paper/95 px-1 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 md:min-h-12 md:flex-nowrap">
        <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => { announcePanel('workflow'); setOpen(true) }} className="group inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-semibold text-ink-strong transition-colors hover:bg-sheet md:min-h-9">
          <ListIcon />
          Workflow
          <span className="tnum rounded-full bg-sheet-deep px-2 py-0.5 text-xs font-bold text-ink-strong">{done}/{total}</span>
        </button>

        {/* The one way around a project: every screen and section is a step. On a phone it is a second row; only the current step shows its name. */}
        <nav aria-label="Workflow steps" className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
          <ol className="flex items-center">
            {steps.map((s, i) => (
              <li key={s.id} data-bar-step={s.id} data-state={s.state} className={`flex items-center ${i === steps.length - 1 ? '' : 'flex-1'}`}>
                <StepLink to={s.to} aria-current={s.id === active ? 'step' : undefined} aria-describedby={`bar-state-${s.id}`} title={`${s.title}: ${STATE_LABEL[s.state].toLowerCase()}`} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full py-1 pr-0 pl-0 text-[0.8125rem] md:pl-0.5 md:pr-0.5 font-semibold whitespace-nowrap transition-colors duration-150 ${s.id === active ? 'bg-accent-wash pr-2.5 text-ink-strong' : 'text-ink hover:bg-sheet hover:text-ink-strong 2xl:pr-2'}`}>
                  <Marker state={s.state} active={s.id === active} n={i + 1} />
                  <span className={s.id === active ? '' : 'max-2xl:sr-only'}>{s.short}</span>
                </StepLink>
                {/* The state is a description of the link, not part of its name (which stays the step's short name). */}
                <span id={`bar-state-${s.id}`} className="sr-only">{STATE_LABEL[s.state]}</span>
                {i === steps.length - 1 ? null : (
                  <span aria-hidden="true" className="relative mx-0.5 h-0.5 min-w-1 md:mx-1 md:min-w-2 flex-1 rounded-full bg-line">
                    <span className={`absolute inset-0 origin-left bg-ok transition-transform duration-500 ease-[var(--ease-out-expo)] ${s.state === 'done' ? 'scale-x-100' : 'scale-x-0'}`} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {next ? (
          <StepLink to={next.to} data-testid="workflow-next" className="group/next ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover md:ml-0 md:min-h-9">
            <span className="hidden sm:inline">Next:</span> {next.short}
            <span className="transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/next:translate-x-0.5"><ArrowRightIcon /></span>
          </StepLink>
        ) : (
          <StepLink to="export" data-testid="workflow-next" className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-ok px-3 text-sm font-semibold text-ok md:ml-0 md:min-h-9"><CheckIcon /> All steps done</StepLink>
        )}
      </div>
    </div>

    {/* Outside the bar: its backdrop blur would otherwise make the bar the containing block of this fixed panel and clip it. */}
      <Drawer open={open} title="Workflow" onClose={() => setOpen(false)}>
        <p className="text-sm text-ink-soft">One project, both modes. Work top to bottom, or jump in anywhere: every step opens its own screen or section.</p>
        <StepLink to="." onNavigate={() => setOpen(false)} className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-accent-strong underline underline-offset-4">Project overview<ArrowRightIcon /></StepLink>
        <ol aria-label="All workflow steps" className="stagger mt-4 divide-y divide-line border-y border-line">
          {steps.map((s, i) => (
            <li key={s.id} data-drawer-step={s.id} data-state={s.state} style={{ ['--i' as string]: i }} className="relative">
              <StepLink to={s.to} onNavigate={() => setOpen(false)} aria-current={s.id === active ? 'step' : undefined} className={`grid gap-0.5 py-3 pr-2 pl-9 transition-colors duration-150 hover:bg-sheet focus-visible:bg-sheet ${s.id === active ? 'bg-accent-wash/60' : ''}`}>
                <span className="absolute top-3 left-2"><Marker state={s.state} active={s.id === active} n={i + 1} /></span>
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
