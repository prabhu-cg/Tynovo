import { buildMessages } from './prompts.js'
import { aiRequestSchema, sanitizeBrand, sanitizeTypeface, type AiError, type AiResponse } from './schemas.js'

/**
 * The server side of the AI assist, as a plain function from a Request to a Response so it can be tested without a
 * server (api/ai.ts is the thin wiring). It holds the key, forwards one request to Groq and returns a validated
 * suggestion. It stores nothing and logs nothing from the request: the brief is not kept anywhere here.
 */
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
/** Largest request body accepted, in bytes: a brief of the maximum length with room for the JSON around it. */
const MAX_BODY = 4096
const TIMEOUT_MS = 20_000
/** Per visitor address, per running instance: a brake on a runaway page or script, not a quota. */
export const RATE = { windowMs: 10 * 60_000, max: 20 }

export interface AiEnv {
  GROQ_API_KEY?: string | undefined
  GROQ_MODEL?: string | undefined
}
export interface AiDeps {
  fetch: typeof fetch
  now: () => number
}

/** Sliding window of request times per key. In memory, so each function instance counts for itself. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs)
    if (recent.length >= RATE.max) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    // Forget addresses that have gone quiet, so the map cannot grow without end.
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.every((t) => now - t >= RATE.windowMs)) this.hits.delete(k)
    return true
  }
}
const limiter = new RateLimiter()

const STATUS: Record<AiError, number> = { 'bad-request': 400, forbidden: 403, 'rate-limited': 429, unavailable: 503, 'bad-answer': 502, timeout: 504 }
const MESSAGE: Record<AiError, string> = {
  'bad-request': 'The request was not understood. Write a sentence or two, up to 1,200 characters.',
  forbidden: 'This request did not come from the Tynovo page.',
  'rate-limited': 'Too many suggestions in a short time. Wait a few minutes and try again.',
  unavailable: 'The AI assistant is not available right now. Everything else in Tynovo works; the rule-based suggestions are unaffected.',
  'bad-answer': 'The assistant’s answer could not be used. Try rewording the brief.',
  timeout: 'The assistant took too long to answer. Try again.',
}

function json(body: AiResponse, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } })
}
const fail = (error: AiError, extra?: Record<string, string>) => json({ ok: false, error, message: MESSAGE[error] }, STATUS[error], extra)

/** Only the site's own pages may call this: the Origin must name the host the request arrived at (or localhost for development). */
function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const o = new URL(origin)
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
    return o.host === host || o.hostname === 'localhost'
  } catch {
    return false
  }
}

export async function handleAi(request: Request, env: AiEnv, deps: AiDeps = { fetch, now: Date.now }): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } })
  if (!sameSite(request)) return fail('forbidden')
  if (!env.GROQ_API_KEY) {
    console.error('ai: GROQ_API_KEY is not set in this environment')
    return fail('unavailable')
  }

  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]!.trim()
  if (!limiter.allow(ip, deps.now())) return fail('rate-limited', { 'retry-after': String(Math.ceil(RATE.windowMs / 1000)) })

  const body = await request.text()
  if (body.length > MAX_BODY) return fail('bad-request')
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return fail('bad-request')
  }
  const req = aiRequestSchema.safeParse(parsed)
  if (!req.success) return fail('bad-request')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await deps.fetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        messages: buildMessages(req.data.task, req.data.text),
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    return fail(e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : 'unavailable')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 429) return fail('rate-limited')
  if (!res.ok) {
    // For the operator, never the visitor: the status and Groq's error type and code (not its message, not the key, not the brief).
    let detail = ''
    try {
      const err = (await res.json()) as { error?: { type?: unknown; code?: unknown } }
      detail = ` ${String(err.error?.type ?? '').slice(0, 60)} ${String(err.error?.code ?? '').slice(0, 60)}`.trimEnd()
    } catch {
      /* not JSON: the status alone is enough */
    }
    console.error(`ai: Groq answered ${res.status}${detail}`)
    return fail('unavailable') // a bad key, a retired model, 5xx and the rest look the same to the visitor; the status is not passed on
  }

  let content: unknown
  try {
    const answer = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> }
    content = answer.choices?.[0]?.message?.content
    if (typeof content !== 'string') return fail('bad-answer')
    content = JSON.parse(content)
  } catch {
    return fail('bad-answer')
  }
  if (req.data.task === 'brand') {
    const data = sanitizeBrand(content)
    return data ? json({ ok: true, task: 'brand', data }, 200) : fail('bad-answer')
  }
  const data = sanitizeTypeface(content)
  return data ? json({ ok: true, task: 'typeface', data }, 200) : fail('bad-answer')
}
