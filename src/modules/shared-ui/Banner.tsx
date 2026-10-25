import type { ReactNode } from 'react'

type Tone = 'info' | 'warn' | 'error' | 'ok'

const tones: Record<Tone, string> = {
  info: 'border-line-strong bg-sheet text-ink',
  warn: 'border-[#e0c27a] bg-[#fdf6e3] text-[#5c3d00]',
  error: 'border-[#e5aaa6] bg-[#fdeceb] text-[#7a1712]',
  ok: 'border-[#a9cdb0] bg-[#eef7f0] text-[#1f4a29]',
}

/** Inline status message. Errors/warnings are announced; info is polite. */
export function Banner({ tone = 'info', children, actions }: { tone?: Tone; children: ReactNode; actions?: ReactNode }) {
  return (
    <div role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  )
}
