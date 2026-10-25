import type { SaveState } from './useProjectEditor'

const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

const COPY: Record<SaveState, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Could not save',
  conflict: 'Changed elsewhere',
  invalid: 'Name needed',
}

/** Autosave indicator. Announced politely; the colour is a reinforcement, the words carry the meaning. */
export function SaveStatus({ state, lastSavedAt }: { state: SaveState; lastSavedAt: Date | null }) {
  const bad = state === 'error' || state === 'conflict' || state === 'invalid'
  return (
    <p role="status" aria-live="polite" className={`tnum flex items-center gap-2 text-sm ${bad ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${bad ? 'bg-danger' : state === 'saved' ? 'bg-ok' : 'animate-pulse bg-accent'}`} />
      <span>
        {COPY[state]}
        {state === 'saved' && lastSavedAt ? <span className="text-ink-soft"> · {time.format(lastSavedAt)}</span> : null}
      </span>
    </p>
  )
}
