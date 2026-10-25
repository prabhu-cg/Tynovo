import { Banner, Button, ButtonLink } from '@/modules/shared-ui'
import { useState } from 'react'
import { FontExportFlow } from './FontExportFlow'
import { useProject } from './project'
import { exportProjectFile } from './projectFile'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function ExportPage() {
  const { draft } = useProject()
  const [saved, setSaved] = useState<string | null>(null)
  return (
    <div className="grid gap-10">
      <section aria-labelledby="pf-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="pf-h" className="text-lg font-bold">Project file</h2>
        <div>
          <p className="max-w-xl">Everything in this project as one JSON file: brand notes, type scale, roles and the typeface. Use it as a backup or to open the project on another device.</p>
          <Button className="mt-4" onClick={() => setSaved(exportProjectFile(draft))}>Download project file</Button>
          {saved ? <p role="status" className="mt-2 text-sm text-ok">Saved {saved}.</p> : null}
        </div>
      </section>

      <section aria-labelledby="font-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="font-h" className="text-lg font-bold">Font file</h2>
        <div>
          {draft.customTypeface ? (
            <>
              <p className="max-w-xl">Export <strong>{draft.customTypeface.familyName} {draft.customTypeface.styleName}</strong> as a TrueType (.ttf) or OpenType/CFF (.otf) file. The typeface is checked before the file is built, and the finished file is opened again and compared with the design before it is offered.</p>
              <div className="mt-4"><FontExportFlow /></div>
            </>
          ) : (
            <Banner tone="info" actions={<ButtonLink to="../typeface">Open the typeface creator</ButtonLink>}>This project has no custom typeface yet.</Banner>
          )}
        </div>
      </section>

      <section aria-labelledby="spec-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="spec-h" className="text-lg font-bold">Specification and code</h2>
        <p className="max-w-xl text-ink-soft">Typography documentation and CSS or JSON tokens are in development and not available yet.</p>
      </section>

      <section aria-labelledby="hist-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="hist-h" className="text-lg font-bold">Export history</h2>
        {draft.exportHistory.length === 0 ? (
          <p className="text-ink-soft">Nothing exported yet. Font exports are recorded here with their size and SHA-256 checksum.</p>
        ) : (
          <ul className="tnum divide-y divide-line rounded-md border border-line bg-paper text-sm">
            {draft.exportHistory.map((h) => (
              <li key={h.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto]">
                <span className="font-semibold text-ink-strong">{h.filename}</span>
                <span className="text-ink-soft">{fmt.format(new Date(h.at))} · {h.bytes} bytes</span>
                {h.sha256 ? <span className="break-all text-xs text-ink-soft sm:col-span-2">SHA-256 {h.sha256}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
