import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner, Button } from '@/modules/shared-ui'
import { DeletePanel } from './DeletePanel'
import { describeError } from './errors'
import { useProject } from './project'
import { exportProjectFile } from './projectFile'
import { useStudio } from './studio'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function ProjectSettingsPage() {
  const { draft, editor } = useProject()
  const { service, storageKind } = useStudio()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const duplicate = async () => {
    try {
      if (!(await editor.flush())) return
      const copy = await service.duplicate(draft.id)
      void navigate(`/app/projects/${copy.id}`)
    } catch (e) {
      setError(describeError(e))
    }
  }
  const remove = async () => {
    try {
      await editor.flush() // settle pending autosave so leaving the page is not blocked
      await service.delete(draft.id)
      void navigate('/app/projects', { replace: true })
    } catch (e) {
      setError(describeError(e))
    }
  }

  return (
    <div className="grid gap-10">
      {error ? <Banner tone="error">{error}</Banner> : null}
      <section aria-labelledby="dup-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="dup-h" className="text-lg font-bold">Duplicate</h2>
        <div>
          <p className="max-w-xl">Make an independent copy with a new name. The export history is not copied.</p>
          <Button className="mt-4" onClick={() => void duplicate()}>Duplicate this project</Button>
        </div>
      </section>
      <section aria-labelledby="bk-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="bk-h" className="text-lg font-bold">Backup</h2>
        <div>
          <p className="max-w-xl">Projects live in this browser only. Download a file to keep a copy elsewhere.</p>
          <Button className="mt-4" onClick={() => exportProjectFile(draft)}>Download project file</Button>
        </div>
      </section>
      <section aria-labelledby="info-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="info-h" className="text-lg font-bold">Details</h2>
        <dl className="tnum grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-soft">Created</dt><dd>{fmt.format(new Date(draft.createdAt))}</dd>
          <dt className="text-ink-soft">Last saved</dt><dd>{fmt.format(new Date(draft.updatedAt))}</dd>
          <dt className="text-ink-soft">Schema version</dt><dd>{draft.schemaVersion}</dd>
          <dt className="text-ink-soft">Stored in</dt><dd>{storageKind === 'indexeddb' ? 'this browser (IndexedDB)' : 'memory only (not saved after you close the tab)'}</dd>
          <dt className="text-ink-soft">Project id</dt><dd className="break-all">{draft.id}</dd>
        </dl>
      </section>
      <section aria-labelledby="del-h" className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-line pt-8 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
        <h2 id="del-h" className="text-lg font-bold text-danger">Delete</h2>
        <div>
          <p className="max-w-xl">Deleting removes this project from this browser. It cannot be undone. You will be offered a backup file first.</p>
          {confirming ? (
            <div className="mt-4 max-w-xl">
              <DeletePanel name={draft.name} confirmLabel="Delete project" cancelLabel="Keep it" onBackup={async () => exportProjectFile(draft)} onConfirm={() => void remove()} onCancel={() => setConfirming(false)} />
            </div>
          ) : (
            <Button className="mt-4" onClick={() => setConfirming(true)}>Delete this project…</Button>
          )}
        </div>
      </section>
    </div>
  )
}
