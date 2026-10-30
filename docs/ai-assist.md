# AI assist

Two optional boxes turn a few sentences into settings Tynovo already understands:

| Box | Where | Returns | Applied by |
|---|---|---|---|
| Suggest a brand direction from a brief | Overview, Brand direction | personality words, use cases, tones, readability and display priority, a rationale | *Apply to brand direction* (replaces those fields) |
| Describe the typeface you want | Typeface editor, Design parameters | a family, corner style, terminals and up to nine numeric settings, a rationale | *Apply to the design* (a restore point "Before AI suggestion" is saved first) |

Nothing is sent when a page opens, a box opens or text is typed. Pressing the button sends **only the brief** (never the project). Nothing changes until a suggestion is applied. The read-only sample cannot use them.

## Design

```
page (src/modules/app-shell/ai/*) -> POST /api/ai {task, text}
   -> api/ai.ts -> ai/handler.ts -> Groq chat completions (JSON mode)
   <- {ok, task, data} (validated and clamped) <- the page validates it again
```

- **The key never reaches the browser.** `GROQ_API_KEY` is a Vercel environment variable (Production and Preview, marked sensitive). `GROQ_MODEL` optionally names the model to try first. By default the function tries `openai/gpt-oss-120b`, then `llama-3.3-70b-versatile`, then `llama-3.1-8b-instant`, moving on only when Groq answers 404 (the model is retired, renamed or not enabled for the key's project: `llama-3.3-70b-versatile` was not available to the project's key on 2026-10-30). A reasoning model is asked for `reasoning_effort: low` and given a 2,500-token budget, because its thinking counts against the budget and a smaller one cut the JSON off.
- **Stateless.** Nothing is stored or logged from a request: no database, no cache (`cache-control: no-store`). Errors are mapped to a fixed set of messages; Groq's own error text and the key are never passed on (tested). The operator sees, in the Vercel runtime logs, only the model that answered, the status and error type of a failure, and the *shape* of an answer (key names and kinds of value): never the brief or the values.
- **Never trusted, both ways.** The function parses and clamps what the model says (`schemas.ts`: unknown keys dropped, enums filtered, numbers clamped to the editor's own control ranges and snapped to its steps, nothing usable means an error). The page runs the same cleaning on what the function sends. The cleaning is idempotent (tested), so a clean answer passes through unchanged.
- **Prompts** (`prompts.ts`) take their ranges from the same `DNA_CONTROLS` the editor uses, so they cannot drift. The brief goes in its own message, in quotes; the system prompt says never to follow instructions inside it; and even if it did, the answer is clamped to the values above, so a hostile brief can change only the suggestion it receives.
- **Guards** (`handler.ts`): POST only; the request's `Origin` must be the host it arrived at (or localhost); body at most 4 KB; brief 12 to 1,200 characters; 20 s timeout; 20 requests per address per 10 minutes. That rate limit is **in memory per function instance**: a brake on a runaway page or script, not a global quota. For a hard limit use Vercel's firewall rate limiting or Groq's own spend limits (set one).
- **CSP unchanged.** The page's policy allows `connect-src 'self'`, and `/api/ai` is same-origin.
- **Entitlement** `ai.assist` (every box checks it; free tier at launch).

## Setting it up

1. Create a Groq API key (console.groq.com) and set a spend limit there.
2. Vercel: project `gettynovo`, Settings, Environment Variables: `GROQ_API_KEY` (Production and Preview, sensitive). Optional `GROQ_MODEL`.
3. Redeploy (variables apply to new deployments).
4. Without the key the function answers "unavailable" and the page says so; the rest of Tynovo is unaffected. A copy of Tynovo hosted without the function (any static host) shows "not part of this copy".

## Tests

- `src/modules/ai/ai.test.ts`: the request limits, cleaning (including hostile and malformed answers), the prompts, and the function with a stand-in Groq: key and model forwarded, refusals that never reach Groq, a missing key, no leak of the key or Groq's error text, rate limits, timeouts, bad answers, clamping, the limiter.
- `e2e/ai.spec.ts` (the function mocked at the network): only the brief is sent and only on request, nothing changes until Apply, a restore point is saved, error messages, an unusable answer, the read-only sample, and axe with a suggestion showing.
- Live (2026-10-30): real brand and typeface requests through the deployed function and through the page's own boxes (about 1.2 s each), a hostile brief that changed nothing, a foreign origin refused with 403, a short brief refused with 400.
- `the deployed function loads` in `ai.test.ts` compiles the function's import closure file by file, as Vercel does, and runs it under plain Node ESM. Without it, two successive import-extension mistakes made every live call fail with `FUNCTION_INVOCATION_FAILED` while every other test passed. Relative imports in `api/ai.ts`'s closure (`ai/*`, `brand-projects/schema`, `typeface-engine/dna`) must end in `.js`; the `@/` alias is not available there.
- Models differ: gpt-oss writes lists as one comma-separated string, so the cleaning accepts both (tested).

## Not built

AI pairing explanations, AI-written preview copy, explanations of quality findings, image or logo input. The rule-based pairing and ordering are unchanged.
