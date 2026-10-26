import { useState } from 'react'
import { Button, CheckIcon, DownloadIcon } from '@/modules/shared-ui'
import { describeError } from './errors'

/**
 * Asks before a project is deleted, and offers a backup first. Deleting is permanent: the project exists only in
 * this browser. Taking a backup never deletes, and deleting never requires one; the person decides.
 */
export function DeletePanel({
  name,
  confirmLabel = 'Delete',
  cancelLabel = 'Keep',
  onBackup,
  onConfirm,
  onCancel,
}: {
  name: string
  confirmLabel?: string
  cancelLabel?: string
  /** Download the project file; resolves to its file name. */
  onBackup: () => Promise<string>
  onConfirm: () => void
  onCancel: () => void
}) {
  const [backup, setBackup] = useState<{ file: string } | { error: string } | null>(null)
  return (
    <div className="grid gap-2" role="group" aria-label={`Confirm deleting ${name}`}>
      <p className="text-sm font-semibold text-danger">Delete “{name}” permanently? Its typography, typeface and export history are removed from this browser and cannot be brought back.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void onBackup().then((file) => setBackup({ file }), (e: unknown) => setBackup({ error: describeError(e) }))}><DownloadIcon />Download a backup first</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
      </div>
      {backup && 'file' in backup ? <p role="status" className="flex items-center gap-1.5 text-sm text-ok"><CheckIcon />Backup saved as {backup.file}. Import it on the Projects page to get the project back.</p> : null}
      {backup && 'error' in backup ? <p role="alert" className="text-sm text-danger">The backup could not be made: {backup.error} Nothing was deleted.</p> : null}
    </div>
  )
}
