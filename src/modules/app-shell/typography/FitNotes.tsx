import type { FitFinding, RoleFit } from '@/modules/brand-system/fit'
import { AlertIcon, Button, InfoIcon } from '@/modules/shared-ui'

const VERDICT_TEXT: Record<RoleFit['verdict'], string> = {
  suitable: 'Suitable for this role',
  caution: 'Use with care',
  unsuitable: 'Not appropriate for this role',
}

const LEVEL_TEXT: Record<FitFinding['level'], string> = { blocks: 'Not appropriate', warns: 'Check', notes: 'Note' }

/** Why the custom typeface does or does not suit a role. Every line carries its words; colour only reinforces. */
export function FitNotes({ fit, onFix }: { fit: RoleFit; onFix?: (f: NonNullable<FitFinding['fix']>) => void }) {
  if (fit.findings.length === 0) return null
  return (
    <ul aria-label="Fit of the custom typeface" className="grid gap-1.5 text-sm">
      {fit.findings.map((f) => (
        <li key={f.id} data-finding={f.id} className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase ${f.level === 'blocks' ? 'text-danger' : f.level === 'warns' ? 'text-warn' : 'text-ink-soft'}`}>
            {f.level === 'notes' ? <InfoIcon /> : <AlertIcon />}
            {LEVEL_TEXT[f.level]}
          </span>
          <span className="min-w-0 flex-1 basis-60">{f.message}</span>
          {f.fix && onFix ? <Button variant="ghost" className="!min-h-8 underline underline-offset-4" onClick={() => onFix(f.fix!)}>{f.fix.label}</Button> : null}
        </li>
      ))}
    </ul>
  )
}

export function VerdictChip({ verdict }: { verdict: RoleFit['verdict'] }) {
  const tone = verdict === 'suitable' ? 'text-ok border-ok' : verdict === 'caution' ? 'text-warn border-warn' : 'text-danger border-danger'
  return <span data-verdict={verdict} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${tone}`}>{verdict === 'suitable' ? null : <AlertIcon />}{VERDICT_TEXT[verdict]}</span>
}
