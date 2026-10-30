import { handleAi } from '../src/modules/ai/handler.js'

/**
 * POST /api/ai: forwards a brief to Groq with the key held in the GROQ_API_KEY environment variable and returns a
 * validated suggestion. The logic and its tests are in src/modules/ai/handler.ts; nothing is stored here.
 */
export async function POST(request: Request): Promise<Response> {
  return handleAi(request, { GROQ_API_KEY: process.env['GROQ_API_KEY'], GROQ_MODEL: process.env['GROQ_MODEL'] })
}

export function GET(): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } })
}
