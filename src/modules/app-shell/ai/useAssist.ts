import { useRef, useState } from 'react'
import type { AiResult } from '@/modules/ai/client'

export type AssistState<T> = { status: 'idle' } | { status: 'asking' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** One AI request at a time, cancellable, with its result kept until it is applied or dismissed. */
export function useAssist<T>(run: (text: string, signal: AbortSignal) => Promise<AiResult<T>>) {
  const [state, setState] = useState<AssistState<T>>({ status: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const ask = async (text: string) => {
    abort.current?.abort()
    const c = new AbortController()
    abort.current = c
    setState({ status: 'asking' })
    const r = await run(text, c.signal)
    if (c.signal.aborted) return
    setState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', message: r.message })
  }
  const clear = () => {
    abort.current?.abort()
    setState({ status: 'idle' })
  }
  return { state, ask, clear }
}
