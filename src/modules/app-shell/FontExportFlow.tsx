import { useState } from 'react'
import { downloadBytes } from '@/modules/font-export/download'
import { exportTypeface, type TypefaceExport } from '@/modules/font-export/typefaceExport'
import { Banner, Button, Drawer } from '@/modules/shared-ui'
import { useProject } from './project'

/** Validate, build and download a TrueType file; records the export in the project's history. */
export function FontExportFlow() {
  const { draft, editor } = useProject()
  const [result, setResult] = useState<TypefaceExport | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const run = async () => {
    setBusy(true)
    setFailure(null)
    try {
      setResult(await exportTypeface(draft, () => crypto.randomUUID(), () => new Date()))
      setOpen(true)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The font could not be built.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="primary" disabled={busy} onClick={() => void run()}>{busy ? 'Building…' : 'Validate and export TrueType…'}</Button>
      {failure ? <div className="mt-3"><Banner tone="error">{failure}</Banner></div> : null}
      <Drawer open={open} title="Font export" onClose={() => setOpen(false)}>
        {result ? (
          <div className="grid gap-4">
            {result.ok ? (
              <Banner tone="ok">Built a TrueType file: {result.build.bytes.byteLength} bytes. {result.binary.errorCount} errors and {result.binary.warningCount} warnings in the final file.</Banner>
            ) : (
              <Banner tone="error">Export blocked: fix the errors below first. No file was produced.</Banner>
            )}
            <ul className="grid gap-2 text-sm" aria-label="Validation results">
              {[...result.model.issues, ...(result.ok ? result.binary.issues.filter((i) => i.severity !== 'info') : [])].map((i, n) => (
                <li key={n} className="rounded-md border border-line p-3">
                  <span className={`text-xs font-bold uppercase ${i.severity === 'error' ? 'text-danger' : i.severity === 'warning' ? 'text-warn' : 'text-ink-soft'}`}>{i.severity}</span>
                  {i.glyph ? <span className="ml-2 text-xs font-semibold text-ink-strong">glyph {i.glyph}</span> : null}
                  <p>{i.message}</p>
                </li>
              ))}
              {result.model.issues.length === 0 && (!result.ok || result.binary.issues.every((i) => i.severity === 'info')) ? <li className="text-ink-soft">No issues reported.</li> : null}
            </ul>
            {result.ok ? (
              <Button
                variant="primary"
                onClick={() => {
                  downloadBytes(result.build.bytes, result.build.filename, result.build.mimeType)
                  editor.patch((p) => ({ ...p, exportHistory: [result.record, ...p.exportHistory] }))
                  setOpen(false)
                }}
              >
                Download {result.build.filename}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
