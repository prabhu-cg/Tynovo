import { useMemo, useState } from 'react'
import { fontsInUse, isExisting } from '@/modules/brand-system/fonts'
import { assessProject } from '@/modules/brand-system/readiness'
import { downloadBytes } from '@/modules/font-export/download'
import type { ExportFile } from '@/modules/export-centre/types'
import { Banner, Button, ButtonLink } from '@/modules/shared-ui'
import { viewOf } from '@/modules/entitlements'
import { useCapabilities } from './entitlements'
import { EXPORT_FEATURE } from './export/exportFeatures'
import { FileRow } from './export/FileRow'
import { ReadinessList } from './export/ReadinessList'
import { useBundle } from './export/useBundle'
import { FontExportFlow } from './FontExportFlow'
import { useProject } from './project'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

/** The export centre: everything the shared project can produce, built from the saved state, with the checks beside it. */
export function ExportPage() {
  const { editor, fonts } = useProject()
  const caps = useCapabilities()
  const saved = editor.saved
  const state = useBundle(saved)
  const [done, setDone] = useState<string | null>(null)
  const settled = editor.state === 'saved'
  // The checks include whether each font can really be drawn right now, so they follow the loader's states.
  const availabilityKey = [...fonts.availability].map(([id, a]) => `${id}:${a.status}`).join(',')
  const issues = useMemo(() => (saved ? assessProject(saved, undefined, fonts.availability) : []), [saved, availabilityKey]) // eslint-disable-line
  if (!saved) return null

  const external = fontsInUse(saved).filter((u) => isExisting(u.font.origin))
  const ready = state.status === 'ready' ? state.bundle : null
  const canDownload = settled && ready !== null

  const download = (file: ExportFile) => {
    if (!ready || !viewOf(EXPORT_FEATURE[file.id], caps).allowed) return // the button is also disabled; every route checks
    downloadBytes(file.bytes, file.path, file.mimeType)
    editor.patch((p) => ({
      ...p,
      exportHistory: [{ id: crypto.randomUUID(), kind: file.kind, at: new Date().toISOString(), filename: file.path, bytes: file.bytes.length, sha256: file.sha256, sourceRevision: ready.revision }, ...p.exportHistory].slice(0, 500),
    }))
    setDone(file.path)
  }
  const file = (id: ExportFile['id']) => ready?.files[id]
  const view = (id: ExportFile['id']) => viewOf(EXPORT_FEATURE[id], caps)
  const rows = ready ? ready.order.filter((id) => id !== 'package' && id !== 'font' && view(id).visible).map((id) => ready.files[id]) : []

  return (
    <div className="grid gap-10">
      {!settled ? (
        <Banner tone="warn" actions={<Button onClick={() => void editor.flush()}>Save now</Button>}>
          <strong>You have changes that are not saved yet.</strong> Exports are built from the saved project, so they stay unavailable until saving finishes. Nothing is exported from an unsaved draft.
        </Banner>
      ) : null}
      <p role="status" data-testid="export-sync" data-revision={ready?.revision ?? ''} className="tnum text-sm text-ink-soft">
        {state.status === 'building' ? 'Preparing exports from the saved project…' : state.status === 'error' ? 'The exports could not be prepared.' : <>Built from the saved project · revision <code className="text-xs text-ink-strong">{ready!.revision}</code>{editor.lastSavedAt ? ` · saved ${time.format(editor.lastSavedAt)}` : ''}</>}
      </p>
      {state.status === 'error' ? <Banner tone="error">{state.message} Your project is unchanged. You can still download the project file from the Settings page.</Banner> : null}

      <section aria-labelledby="chk-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <div>
          <h2 id="chk-h" className="text-lg font-bold">Before you export</h2>
          <p className="mt-1 text-sm text-ink-soft">Checks across the typography system and the typeface together.</p>
        </div>
        <ReadinessList items={issues} />
      </section>

      <section aria-labelledby="files-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <div>
          <h2 id="files-h" className="text-lg font-bold">Files</h2>
          <p className="mt-1 text-sm text-ink-soft">Each file is checked against the saved project. Read it first with “Show contents”.</p>
        </div>
        <div className="grid min-w-0 gap-4">
          {state.status === 'building' ? <p className="text-sm text-ink-soft">Preparing…</p> : null}
          {ready ? (
            <ul aria-label="Export files" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
              {view('package').visible ? <FileRow file={file('package')!} disabled={!canDownload} locked={view('package').message} onDownload={download}>
                <p className="text-xs text-ink-soft">Contains every file below in a layout where the CSS finds your font at <code>fonts/</code>.</p>
              </FileRow> : null}
              {rows.map((f) => (
                <FileRow key={f.id} file={f} disabled={!canDownload} locked={view(f.id).message} onDownload={download}>
                  {f.id === 'css' && external.length > 0 ? (
                    <p data-testid="external-font-note" className="rounded-md bg-sheet px-3 py-2 text-sm">
                      <strong>Font files for {external.map((u) => u.font.family).join(', ')} are not included.</strong> The CSS names {external.length === 1 ? 'this font' : 'these fonts'}; the file may need to be supplied separately (or installed where the page runs). The CSS says where each comes from, and the sources and licences file records its licence.
                    </p>
                  ) : null}
                  {f.id === 'pdf' && external.some((u) => u.font.origin !== 'catalog') ? (
                    <p data-testid="pdf-font-note" className="rounded-md bg-sheet px-3 py-2 text-sm">
                      <strong>{external.filter((u) => u.font.origin !== 'catalog').map((u) => u.font.family).join(', ')}: drawn in Helvetica.</strong> Tynovo has no file for {external.filter((u) => u.font.origin !== 'catalog').length === 1 ? 'this font' : 'these fonts'}, so the PDF cannot embed {external.filter((u) => u.font.origin !== 'catalog').length === 1 ? 'it' : 'them'}. Each sample says so.
                    </p>
                  ) : null}
                </FileRow>
              ))}
              {view('font').visible ? <FileRow file={file('font')!} disabled={!canDownload} locked={view('font').message} onDownload={download} /> : null}
            </ul>
          ) : null}
          {ready ? <p role="status" aria-live="polite" className="text-sm text-ok">{done ? (editor.readOnly ? `Downloaded ${done}.` : `Downloaded ${done}. It is recorded in the history below.`) : ''}</p> : null}
        </div>
      </section>

      <section aria-labelledby="font-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="font-h" className="text-lg font-bold">Font file formats</h2>
        <div>
          {saved.customTypeface ? (
            <>
              <p className="max-w-xl">Export <strong>{saved.customTypeface.familyName} {saved.customTypeface.styleName}</strong> as TrueType (.ttf) or OpenType/CFF (.otf). The typeface is checked before the file is built, and the finished file is opened again and compared with the design before it is offered.</p>
              <div className="mt-4"><FontExportFlow /></div>
            </>
          ) : (
            <Banner tone="info" actions={<ButtonLink to="../typeface">Open the typeface creator</ButtonLink>}>This project has no custom typeface yet.</Banner>
          )}
        </div>
      </section>

      <section aria-labelledby="hist-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="hist-h" className="text-lg font-bold">Export history</h2>
        {saved.exportHistory.length === 0 ? (
          <p className="text-ink-soft">Nothing exported yet. Each export is recorded here with its size, checksum and the project revision it came from.</p>
        ) : (
          <ul aria-label="Export history" className="tnum divide-y divide-line rounded-md border border-line bg-paper text-sm">
            {saved.exportHistory.map((h) => {
              const current = ready && h.sourceRevision ? h.sourceRevision === ready.revision : null
              return (
                <li key={h.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto]">
                  <span className="font-semibold text-ink-strong">{h.filename}</span>
                  <span className="text-ink-soft">{fmt.format(new Date(h.at))} · {h.bytes} bytes</span>
                  {current !== null ? <span data-sync={current ? 'current' : 'stale'} className={`text-xs font-semibold sm:col-span-2 ${current ? 'text-ok' : 'text-warn'}`}>{current ? 'Matches the saved project.' : 'Out of date: the project has changed since this export.'}</span> : null}
                  {h.sha256 ? <span className="break-all text-xs text-ink-soft sm:col-span-2">SHA-256 {h.sha256}</span> : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
