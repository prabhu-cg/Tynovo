import { useRef, useState } from 'react'
import { Button, CheckIcon, DownloadIcon, Modal } from '@/modules/shared-ui'
import { describeError } from './errors'

/**
 * Asks, in a modal, before a project is deleted, and offers a backup first. Deleting is permanent: the project exists
 * only in this browser. Taking a backup never deletes, and deleting never requires one; the person decides. Focus
 * starts on the safe choice, so Enter or Space cannot delete by accident.
 */
export function DeleteDialog({
  open,
  name,
  confirmLabel = 'Delete',
  cancelLabel = 'Keep',
  onBackup,
  onConfirm,
  onCancel,
}: {
  open: boolean
  name: string
  confirmLabel?: string
  cancelLabel?: string
  /** Download the project file; resolves to its file name. */
  onBackup: () => Promise<string>
  onConfirm: () => void
  onCancel: () => void
}) {
  const keep = useRef<HTMLButtonElement>(null)
  return (
    <Modal open={open} title={`Delete “${name}”?`} description="Its typography, typeface and export history are removed from this browser and cannot be brought back." onClose={onCancel} initialFocus={keep}>
      <Body onBackup={onBackup} onConfirm={onConfirm} onCancel={onCancel} confirmLabel={confirmLabel} cancelLabel={cancelLabel} keep={keep} />
    </Modal>
  )
}

/** Its own component so the backup message is forgotten each time the dialog is opened. */
function Body({ onBackup, onConfirm, onCancel, confirmLabel, cancelLabel, keep }: { onBackup: () => Promise<string>; onConfirm: () => void; onCancel: () => void; confirmLabel: string; cancelLabel: string; keep: React.RefObject<HTMLButtonElement | null> }) {
  const [backup, setBackup] = useState<{ file: string } | { error: string } | null>(null)
  return (
    <div className="mt-5 grid gap-4">
      <div>
        <Button onClick={() => void onBackup().then((file) => setBackup({ file }), (e: unknown) => setBackup({ error: describeError(e) }))}><DownloadIcon />Download a backup first</Button>
        {backup && 'file' in backup ? <p role="status" className="mt-2 flex items-start gap-1.5 text-sm text-ok"><CheckIcon className="mt-0.5 shrink-0" />Backup saved as {backup.file}. Import it on the Projects page to get the project back.</p> : null}
        {backup && 'error' in backup ? <p role="alert" className="mt-2 text-sm text-danger">The backup could not be made: {backup.error} Nothing was deleted.</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button ref={keep} onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  )
}
