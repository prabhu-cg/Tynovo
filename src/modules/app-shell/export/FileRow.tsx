import { useState } from 'react'
import type { ExportFile } from '@/modules/export-centre/types'
import { Button, DownloadIcon } from '@/modules/shared-ui'

const decoder = new TextDecoder()
const TEXT = /^(text\/|application\/json)/
const LIMIT = 60_000

function preview(file: ExportFile): string {
  let text = decoder.decode(file.bytes)
  // The specimen embeds the font as base64; showing it would bury the page.
  text = text.replace(/base64,[A-Za-z0-9+/=]{80,}/g, 'base64,…font data…')
  return text.length > LIMIT ? `${text.slice(0, LIMIT)}\n… (${text.length - LIMIT} more characters)` : text
}

const kb = (n: number) => (n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(1)} KB`)

/** One export: what it is, what it is called, a way to read it, and a way to take it. */
export function FileRow({ file, disabled, locked, onDownload, children }: { file: ExportFile; disabled: boolean; /** Why the plan leaves this export out, when it does. */ locked?: string | null | undefined; onDownload: (f: ExportFile) => void; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const canRead = file.available && TEXT.test(file.mimeType)
  return (
    <li data-export={file.id} className="grid gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-72">
          <h3 className="text-base font-bold text-ink-strong">{file.title}</h3>
          <p className="text-sm text-ink">{file.description}</p>
          {file.available ? <p className="tnum mt-1 text-xs break-all text-ink-soft">{file.path} · {kb(file.bytes.length)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canRead ? <Button variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide contents' : 'Show contents'}</Button> : null}
          <Button variant={file.id === 'package' ? 'primary' : 'secondary'} disabled={disabled || !file.available || !!locked} aria-label={`Download ${file.title}`} onClick={() => onDownload(file)}><DownloadIcon />Download</Button>
        </div>
      </div>
      {locked ? <p role="note" data-testid="locked" className="text-sm text-ink-soft">{locked}</p> : null}
      {!file.available ? <p role="note" className="text-sm text-danger">{file.unavailableReason}</p> : null}
      {children}
      {open ? <pre tabIndex={0} aria-label={`Contents of ${file.path}`} className="max-h-96 overflow-auto rounded-md border border-line bg-sheet p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">{preview(file)}</pre> : null}
    </li>
  )
}
