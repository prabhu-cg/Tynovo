import { useState } from 'react'
import { downloadBytes } from '@/modules/font-export/download'
import { FORMATS, FORMAT_IDS, type FontFormatId } from '@/modules/font-export/formats'
import { contentRevision } from '@/modules/brand-system/revision'
import { exportTypeface, type TypefaceExport } from '@/modules/font-export/typefaceExport'
import { runQualityChecks } from '@/modules/font-validation/quality'
import { AlertIcon, Banner, Button, ButtonLink, CheckIcon, Drawer, Segmented } from '@/modules/shared-ui'
import { useProject } from './project'

const NOTES: Record<FontFormatId, string> = {
  ttf: 'TrueType outlines. The widest support in desktop programs, operating systems and browsers.',
  otf: 'OpenType with PostScript (CFF) outlines, the same design. Some print and design workflows prefer it. Both files are checked the same way.',
}

/** Validate, build, re-open and compare a font file, then offer it for download. Failed files are never offered. */
export function FontExportFlow() {
  const { editor } = useProject()
  // Files are built from what is saved, never from an unsaved draft, so they always match what a reload shows.
  const saved = editor.saved
  const settled = editor.state === 'saved'
  const [format, setFormat] = useState<FontFormatId>('ttf')
  const [result, setResult] = useState<TypefaceExport | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const spec = FORMATS[format]

  const run = async () => {
    setBusy(true)
    setFailure(null)
    try {
      if (!saved) throw new Error('The project has not been loaded.')
      // The font's timestamps are the project's creation time, so the same design always gives the same file.
      setResult(await exportTypeface(saved, () => crypto.randomUUID(), () => new Date(saved.createdAt), format, await contentRevision(saved)))
      setOpen(true)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The font could not be built.')
    } finally {
      setBusy(false)
    }
  }

  const quality = saved?.customTypeface ? runQualityChecks(saved.customTypeface).counts : null

  return (
    <>
      <div className="grid max-w-xl gap-3">
        <Segmented label="File format" value={format} options={FORMAT_IDS.map((f) => ({ value: f, label: FORMATS[f].label }))} onChange={(f) => { setFormat(f); setResult(null) }} />
        <p className="text-xs text-ink-soft">{NOTES[format]} WOFF and WOFF2 are not offered: they have not been validated here.</p>
        <div><Button variant="primary" disabled={busy || !settled} onClick={() => void run()}>{busy ? 'Building and checking…' : `Check and build ${spec.extension}…`}</Button></div>
        {!settled ? <p role="status" className="text-xs text-ink-soft">Waiting for your latest changes to be saved, so the file matches the saved project.</p> : null}
        {quality ? (
          <p className="tnum text-sm text-ink-soft">Quality report: {quality.blocking} blocking, {quality.warning} warning{quality.warning === 1 ? '' : 's'}, {quality.recommendation} recommendation{quality.recommendation === 1 ? '' : 's'}. <ButtonLink variant="ghost" to="../typeface?view=quality" className="!min-h-8 !px-1.5 underline underline-offset-4">Open the report</ButtonLink></p>
        ) : null}
      </div>
      {failure ? <div className="mt-3 max-w-xl"><Banner tone="error">{failure} Your project is unchanged.</Banner></div> : null}
      <Drawer open={open} title="Font export" onClose={() => setOpen(false)}>
        {result ? <ExportResult result={result} onDownload={() => {
          if (!result.ok) return
          downloadBytes(result.build.bytes, result.build.filename, result.build.mimeType)
          editor.patch((p) => ({ ...p, exportHistory: [result.record, ...p.exportHistory] }))
          setOpen(false)
        }} /> : null}
      </Drawer>
    </>
  )
}

const STAGE_TEXT = {
  design: 'The design has errors, so no file was built. Fix them first; nothing in your project changed.',
  build: 'The file could not be built, so none is offered. Nothing in your project changed. Try again, or export the other format.',
  file: 'The file was built but failed the studio’s own checks, so it is not offered. Nothing in your project changed.',
} as const

function ExportResult({ result, onDownload }: { result: TypefaceExport; onDownload: () => void }) {
  const spec = FORMATS[result.format]
  const issues = result.ok ? [...result.model.issues, ...result.binary.issues] : result.model.issues
  const shown = issues.filter((i) => i.severity !== 'info')
  const order = { error: 0, warning: 1, info: 2 } as const
  shown.sort((a, b) => order[a.severity] - order[b.severity])
  return (
    <div className="grid gap-4">
      {result.ok ? (
        <Banner tone="ok">Built a {spec.label} file: {result.build.bytes.byteLength.toLocaleString()} bytes. It was opened again and compared with your design: {result.binary.errorCount} errors, {result.binary.warningCount} warnings.</Banner>
      ) : (
        <Banner tone="error"><strong>Export blocked.</strong> {STAGE_TEXT[result.stage]} No file was produced.</Banner>
      )}

      {result.ok ? (
        <section aria-label="What was checked" className="grid gap-2">
          <h3 className="text-sm font-bold text-ink-strong">What held in the finished file</h3>
          <ul className="grid gap-1.5 text-sm">
            {result.passed.map((p) => <li key={p} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-ok"><CheckIcon /></span>{p}</li>)}
          </ul>
        </section>
      ) : null}

      <section aria-label="Validation results" className="grid gap-2">
        <h3 className="text-sm font-bold text-ink-strong">{shown.length ? 'To know' : 'Issues'}</h3>
        {shown.length === 0 ? <p className="text-sm text-ink-soft">No issues reported.</p> : (
          <ul className="grid gap-2 text-sm">
            {shown.map((i, n) => (
              <li key={n} className="rounded-md border border-line p-3">
                <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase ${i.severity === 'error' ? 'text-danger' : 'text-warn'}`}><AlertIcon />{i.severity === 'error' ? 'blocks export' : i.severity}</span>
                {i.glyph ? <span className="ml-2 text-xs font-semibold text-ink-strong">glyph {i.glyph}</span> : null}
                <p>{i.message}</p>
              </li>
            ))}
          </ul>
        )}
        <ButtonLink to="../typeface?view=quality" variant="secondary" className="justify-self-start">Open the quality report</ButtonLink>
      </section>

      {result.ok ? (
        <section aria-label="Download" className="grid gap-2 border-t border-line pt-4">
          <dl className="tnum grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-ink-soft">
            <dt>File name</dt><dd className="text-ink">{result.build.filename}</dd>
            <dt>Media type</dt><dd className="text-ink">{result.build.mimeType}</dd>
            <dt>Outlines</dt><dd className="text-ink">{spec.outlines}</dd>
          </dl>
          <Button variant="primary" onClick={onDownload}>Download {result.build.filename}</Button>
        </section>
      ) : null}
    </div>
  )
}
