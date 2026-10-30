import { useState, type ReactNode } from 'react'
import { MAX_BRIEF, MIN_BRIEF } from '@/modules/ai/schemas'
import { Banner, Button, inputClass } from '@/modules/shared-ui'
import type { AssistState } from './useAssist'

/** The text box, the button and the state of one AI request. The suggestion itself is drawn by the caller. */
export function BriefBox<T>({ id, title, label, placeholder, button, state, onAsk, onClear, disabledNote, children }: {
  id: string
  title: string
  label: string
  placeholder: string
  button: string
  state: AssistState<T>
  onAsk: (text: string) => void
  onClear: () => void
  /** Why the assistant is unavailable (a plan that leaves it out), if it is. */
  disabledNote?: string | undefined
  children?: ReactNode
}) {
  const [text, setText] = useState('')
  const asking = state.status === 'asking'
  const short = text.trim().length < MIN_BRIEF
  return (
    <details className="group rounded-md border border-line bg-paper" data-testid={`${id}-assist`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-bold text-ink-strong md:min-h-9">
        <span>{title} <span className="ml-1 rounded-sm border border-line-strong px-1 text-[0.7rem] font-semibold text-ink-soft">AI</span></span>
        <span aria-hidden="true" className="text-accent-text transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-3 border-t border-line px-3 py-4">
        {disabledNote ? <p data-testid="locked" className="text-sm text-ink-soft">{disabledNote}</p> : null}
        <label className="grid gap-1 text-sm font-semibold text-ink-strong" htmlFor={`${id}-brief`}>{label}</label>
        <textarea id={`${id}-brief`} value={text} rows={4} maxLength={MAX_BRIEF} placeholder={placeholder} onChange={(e) => setText(e.target.value)} className={`${inputClass} py-2 font-normal`} aria-describedby={`${id}-privacy`} />
        <p id={`${id}-privacy`} className="text-xs text-ink-soft">
          Only this text is sent, not your project. It goes through Tynovo’s small server function to Groq, which writes the suggestion; Tynovo stores nothing. Do not put anything confidential in it. Nothing changes until you apply the suggestion.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={asking || short || !!disabledNote} onClick={() => onAsk(text)}>{asking ? 'Asking…' : button}</Button>
          <span className="tnum text-xs text-ink-soft">{text.trim().length} / {MAX_BRIEF}</span>
          {state.status !== 'idle' && !asking ? <Button variant="ghost" onClick={onClear}>Dismiss</Button> : null}
        </div>
        <div aria-live="polite" role="status">
          {state.status === 'error' ? <Banner tone="warn">{state.message}</Banner> : null}
          {asking ? <p className="text-sm text-ink-soft">Waiting for the assistant…</p> : null}
        </div>
        {children}
      </div>
    </details>
  )
}
