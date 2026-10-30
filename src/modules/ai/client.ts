import { aiRequestSchema, sanitizeBrand, sanitizeTypeface, type AiTask, type BrandSuggestion, type TypefaceSuggestion } from './schemas'

/**
 * The page's side of the AI assist. It sends only the brief the person typed into the assist box (never the
 * project), and checks the answer again before anything can use it. A failure is a message, never an exception, and
 * nothing in Tynovo depends on the assistant being there.
 */
export type AiResult<T> = { ok: true; data: T } | { ok: false; message: string }

const UNREACHABLE = 'The AI assistant could not be reached. Check your connection and try again; everything else in Tynovo works without it.'

async function ask(task: AiTask, text: string, signal?: AbortSignal): Promise<AiResult<unknown>> {
  const body = aiRequestSchema.safeParse({ task, text })
  if (!body.success) return { ok: false, message: 'Write a sentence or two first (at least a dozen characters, up to 1,200).' }
  let res: Response
  try {
    res = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body.data), ...(signal ? { signal } : {}) })
  } catch {
    return { ok: false, message: UNREACHABLE }
  }
  type Payload = { ok?: unknown; message?: unknown; data?: unknown }
  let payload: Payload | null
  try {
    payload = (await res.json()) as Payload | null
  } catch {
    return { ok: false, message: res.status === 404 ? 'The AI assistant is not part of this copy of Tynovo (it needs the hosted function).' : UNREACHABLE }
  }
  if (!payload || payload.ok !== true) return { ok: false, message: typeof payload?.message === 'string' ? payload.message : UNREACHABLE }
  return { ok: true, data: payload.data }
}

export async function suggestBrand(text: string, signal?: AbortSignal): Promise<AiResult<BrandSuggestion>> {
  const r = await ask('brand', text, signal)
  if (!r.ok) return r
  const data = sanitizeBrand(r.data)
  return data ? { ok: true, data } : { ok: false, message: 'The assistant’s answer could not be used. Try rewording the brief.' }
}

export async function suggestTypeface(text: string, signal?: AbortSignal): Promise<AiResult<TypefaceSuggestion>> {
  const r = await ask('typeface', text, signal)
  if (!r.ok) return r
  const data = sanitizeTypeface(r.data)
  return data ? { ok: true, data } : { ok: false, message: 'The assistant’s answer could not be used. Try rewording the brief.' }
}
