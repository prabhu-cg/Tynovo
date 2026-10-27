import type { ReactNode } from 'react'
import { AlertIcon, CheckIcon, InfoIcon } from './icons'

type Tone = 'info' | 'warn' | 'error' | 'ok'

const tones: Record<Tone, string> = {
  info: 'border-line-strong bg-sheet text-ink',
  warn: 'border-warn/30 bg-warn-soft text-warn',
  error: 'border-danger/30 bg-danger-soft text-danger',
  ok: 'border-ok/30 bg-ok-soft text-ok',
}

const marks: Record<Tone, { icon: ReactNode; label: string; visible: boolean }> = {
  info: { icon: <InfoIcon />, label: 'Note', visible: false },
  warn: { icon: <AlertIcon />, label: 'Warning', visible: true },
  error: { icon: <AlertIcon />, label: 'Error', visible: true },
  ok: { icon: <CheckIcon />, label: 'Done', visible: true },
}

/**
 * Inline status message. Errors/warnings are announced; info is polite. The kind is never carried by colour alone:
 * every tone has an icon and a word (the word is visible except for plain notes, where it is read out only).
 */
export function Banner({ tone = 'info', children, actions }: { tone?: Tone; children: ReactNode; actions?: ReactNode }) {
  return (
    <div role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      <div className="min-w-0 flex-1">
        <span className={marks[tone].visible ? 'mr-2 inline-flex items-center gap-1.5 align-middle font-bold' : 'sr-only'}>
          {marks[tone].visible ? marks[tone].icon : null}
          {marks[tone].label}{marks[tone].visible ? '' : ': '}
        </span>
        {children}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  )
}
