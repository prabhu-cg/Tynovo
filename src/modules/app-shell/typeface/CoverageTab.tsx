import { analyzeTypeface, describeCoverage } from '@/modules/font-validation/coverage'
import type { CustomTypeface } from '@/modules/brand-projects/schema'

const show = (c: string) => (c === ' ' ? 'space' : c)

export function CoverageTab({ face }: { face: CustomTypeface }) {
  const a = analyzeTypeface(face)
  const notBuilt = [...a.reports.values()].filter((r) => r.status === 'missing')
  const invalid = [...a.reports.values()].filter((r) => r.status === 'invalid')
  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="cov-h">
        <h2 id="cov-h" className="text-lg font-bold">Character coverage</h2>
        <p className="mt-1 max-w-2xl" role="status">{describeCoverage(a)}</p>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">A character counts as supported only when its glyph exists and passes every geometry check. Exported fonts contain exactly the supported glyphs: {a.supportedCount}.</p>
        <table className="tnum mt-4 w-full max-w-2xl text-left text-sm">
          <caption className="sr-only">Coverage by group</caption>
          <thead className="text-xs text-ink-soft uppercase"><tr><th className="py-2 font-semibold">Group</th><th className="font-semibold">Supported</th><th className="font-semibold">Errors</th><th className="font-semibold">Missing</th></tr></thead>
          <tbody className="divide-y divide-line border-t border-line">
            {a.groups.map((g) => (
              <tr key={g.id}><th scope="row" className="py-2 font-semibold text-ink-strong">{g.label}</th><td>{g.supported} / {g.total}</td><td className={g.invalid.length ? 'font-semibold text-danger' : ''}>{g.invalid.length}</td><td>{g.missing.length}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="miss-h">
        <h2 id="miss-h" className="text-lg font-bold">Not in the font</h2>
        {notBuilt.length === 0 ? <p className="mt-1 text-ink-soft">Every target character is supported.</p> : (
          <ul className="mt-2 grid max-w-2xl gap-2 text-sm">
            {notBuilt.map((r) => (
              <li key={r.char} className="flex gap-3 rounded-md border border-line bg-paper px-3 py-2"><span className="w-10 shrink-0 font-bold text-ink-strong">{show(r.char)}</span><span className="text-ink-soft">{r.reason === 'no-recipe' ? 'Not designed yet in this engine version.' : r.message}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="inv-h">
        <h2 id="inv-h" className="text-lg font-bold">Glyphs with errors</h2>
        {invalid.length === 0 ? <p className="mt-1 text-ink-soft">None. Every generated glyph passes validation.</p> : (
          <ul className="mt-2 grid max-w-2xl gap-2 text-sm">
            {invalid.map((r) => (
              <li key={r.char} className="rounded-md border border-danger bg-[#fdeceb] px-3 py-2"><span className="font-bold text-ink-strong">{show(r.char)}</span> <span className="text-danger">{r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
