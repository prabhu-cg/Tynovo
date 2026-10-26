import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppSeo } from '@/modules/marketing/Seo'
import { projectFilename, serializeProject } from '@/modules/brand-projects/model'
import { ImportError } from '@/modules/brand-projects/service'
import type { ProjectSummary } from '@/modules/brand-projects/schema'
import { downloadBytes } from '@/modules/font-export/download'
import type { ProjectListing, UnreadableRecord } from '@/modules/persistence/types'
import { Banner, Button, Drawer, inputClass } from '@/modules/shared-ui'
import { DeletePanel } from './DeletePanel'
import { describeError } from './errors'
import { useStudio } from './studio'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const textBytes = (s: string) => new TextEncoder().encode(s)

const STARTS = [
  { value: '', label: 'Overview', hint: 'Name the brand and describe its personality first.' },
  { value: 'typography', label: 'Brand Typography System', hint: 'Start with the type scale and roles.' },
  { value: 'typeface', label: 'Custom Typeface Creator', hint: 'Start with an original typeface.' },
] as const

export function DashboardPage() {
  const { service, storageKind } = useStudio()
  const navigate = useNavigate()
  const [listing, setListing] = useState<ProjectListing | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error' | 'warn'; text: string; details?: string[] } | null>(null)
  const [recoverable, setRecoverable] = useState<{ name: string; text: string; message: string } | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setListing(await service.list())
      setLoadError(null)
    } catch (e) {
      setLoadError(describeError(e))
    }
  }, [service])
  useEffect(() => void refresh(), [refresh])

  const run = async (fn: () => Promise<string | { warn: string; details: string[] } | void>) => {
    try {
      const msg = await fn()
      setNotice(!msg ? null : typeof msg === 'string' ? { tone: 'ok', text: msg } : { tone: 'warn', text: msg.warn, details: msg.details })
    } catch (e) {
      setNotice({ tone: 'error', text: describeError(e) })
    }
    await refresh()
  }

  const backupOne = async (id: string): Promise<string> => {
    const project = await service.get(id)
    if (!project) throw new Error('Project not found.')
    downloadBytes(textBytes(serializeProject(project)), projectFilename(project), 'application/json')
    return projectFilename(project)
  }

  const exportOne = (p: ProjectSummary) =>
    run(async () => {
      const project = await service.get(p.id)
      if (!project) throw new Error('Project not found.')
      downloadBytes(textBytes(serializeProject(project)), projectFilename(project), 'application/json')
      return `Exported “${project.name}”.`
    })

  const importFiles = (files: FileList | null) =>
    run(async () => {
      if (!files?.length) return
      const msgs: string[] = []
      setRecoverable(null)
      for (const file of files) {
        const text = await file.text()
        try {
          const { project, renamedOnClash } = await service.importFile(text)
          msgs.push(renamedOnClash ? `Imported as a copy: “${project.name}”` : `Imported “${project.name}”`)
        } catch (e) {
          // A project file with damaged parts can be partly recovered, but only if the person chooses to.
          if (e instanceof ImportError && e.recoverable) setRecoverable({ name: file.name, text, message: e.message })
          else throw e
        }
      }
      if (fileRef.current) fileRef.current.value = ''
      return msgs.length ? msgs.join('. ') + '.' : undefined
    })

  const downloadRaw = (u: UnreadableRecord) => downloadBytes(textBytes(JSON.stringify(u.raw, null, 2)), `unreadable-${u.id}.json`, 'application/json')

  const projects = listing?.projects ?? []

  return (
    <div className="mx-auto max-w-4xl">
      <AppSeo title="Projects" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Projects</h1>
          <p className="mt-1 text-ink-soft">Stored in this browser. Export a file to back up or move a project.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={(e) => void importFiles(e.target.files)} aria-label="Import project file" />
          <Button onClick={() => fileRef.current?.click()}>Import project file</Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}>New project</Button>
        </div>
      </header>

      {storageKind === 'memory' ? <div className="mt-6"><Banner tone="warn">Browser storage is unavailable, so projects here are kept in memory and will be gone when you close this tab. Export a project file to keep your work.</Banner></div> : null}
      {notice ? (
        <div className="mt-6">
          <Banner tone={notice.tone}>
            {notice.text}
            {notice.details ? <ul className="mt-2 grid list-disc gap-0.5 pl-5">{notice.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}
          </Banner>
        </div>
      ) : null}
      {recoverable ? (
        <div className="mt-6">
          <Banner
            tone="warn"
            actions={
              <>
                <Button onClick={() => void run(async () => { const r = await service.recoverFile(recoverable.text); setRecoverable(null); return { warn: `Recovered “${r.project.name}” from ${recoverable.name}. Some parts could not be read:`, details: r.losses } })}>Recover what can be read</Button>
                <Button variant="ghost" onClick={() => setRecoverable(null)}>Dismiss</Button>
              </>
            }
          >
            <strong>{recoverable.name} is a project file, but parts of it are damaged or from an incompatible version.</strong> {recoverable.message} Nothing was imported. Recovery makes a new project from the readable parts and lists what was lost.
          </Banner>
        </div>
      ) : null}
      {loadError ? <div className="mt-6"><Banner tone="error" actions={<Button onClick={() => void refresh()}>Try again</Button>}>Could not load projects: {loadError}</Banner></div> : null}

      <section aria-label="Your projects" aria-busy={listing === null && !loadError} className="mt-8">
        {listing === null && !loadError ? (
          <ul aria-label="Loading projects" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
            {[0, 1, 2].map((n) => (
              <li key={n} className="flex animate-pulse items-center gap-4 px-4 py-4" aria-hidden="true">
                <div className="grid flex-1 gap-2"><div className="h-4 w-1/3 rounded bg-sheet-deep" /><div className="h-3 w-1/4 rounded bg-sheet" /></div>
                <div className="h-8 w-40 rounded bg-sheet" />
              </li>
            ))}
          </ul>
        ) : listing && projects.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
            <h2 className="text-xl font-extrabold">No projects yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">A project holds a brand’s type scale and roles and, optionally, an original typeface. Everything stays in this browser.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setNewOpen(true)}>Create your first project</Button>
              <Button onClick={() => fileRef.current?.click()}>Import a project file</Button>
            </div>
          </div>
        ) : listing ? (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
                <div className="min-w-48 flex-1">
                  {renaming?.id === p.id ? (
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void run(async () => {
                          await service.rename(p.id, renaming.name)
                          setRenaming(null)
                        })
                      }}
                    >
                      <input autoFocus aria-label={`New name for ${p.name}`} value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} maxLength={120} className={`${inputClass} min-w-0 flex-1`} />
                      <Button type="submit" variant="primary">Save</Button>
                      <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <Link to={`/app/projects/${p.id}`} className="inline-flex min-h-8 items-center text-base font-bold text-ink-strong underline-offset-4 hover:text-accent hover:underline">{p.name}</Link>
                      <p className="tnum text-xs text-ink-soft">Edited {fmt.format(new Date(p.updatedAt))}{p.hasCustomTypeface ? ' · custom typeface' : ''}</p>
                    </>
                  )}
                </div>
                {confirmDelete === p.id ? (
                  <div className="basis-full md:basis-auto md:max-w-lg">
                    <DeletePanel
                      name={p.name}
                      onBackup={() => backupOne(p.id)}
                      onConfirm={() => void run(async () => { await service.delete(p.id); setConfirmDelete(null); return `Deleted “${p.name}”.` })}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => setRenaming({ id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}>Rename</Button>
                    <Button variant="ghost" onClick={() => void run(async () => { const c = await service.duplicate(p.id); return `Duplicated as “${c.name}”.` })} aria-label={`Duplicate ${p.name}`}>Duplicate</Button>
                    <Button variant="ghost" onClick={() => void exportOne(p)} aria-label={`Export ${p.name}`}>Export</Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(p.id)} aria-label={`Delete ${p.name}`}>Delete</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {listing && listing.unreadable.length > 0 ? (
        <section aria-label="Unreadable records" className="mt-10">
          <h2 className="text-lg font-bold">Records that could not be opened</h2>
          <p className="mt-1 text-sm text-ink-soft">These are kept untouched. Recovery builds a new project from the readable parts and lists what was lost; the damaged record stays until you remove it.</p>
          <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-paper">
            {listing.unreadable.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-48 flex-1"><p className="font-semibold text-ink-strong">{u.id}</p><p className="text-sm text-danger">{u.reason}</p></div>
                <Button variant="ghost" onClick={() => void run(async () => { const r = await service.recoverRecord(u.id); return { warn: `Recovered “${r.project.name}” as a new project. The damaged record is still listed below; remove it when you are happy. Some parts could not be read:`, details: r.losses } })}>Recover what can be read</Button>
                <Button variant="ghost" onClick={() => downloadRaw(u)}>Download raw data</Button>
                <Button variant="ghost" onClick={() => void run(async () => { await service.delete(u.id); return 'Removed unreadable record.' })}>Remove</Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NewProjectDrawer
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={async (name, start) => {
          const p = await service.create(name)
          void navigate(`/app/projects/${p.id}${start ? `/${start}` : ''}`)
        }}
      />
    </div>
  )
}

function NewProjectDrawer({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, start: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    onCreate(name, start).catch((err: unknown) => {
      setError(describeError(err))
      setBusy(false)
    })
  }
  return (
    <Drawer open={open} title="New project" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <div className="grid gap-1">
          <label htmlFor={`${id}-name`} className="text-sm font-semibold text-ink-strong">Project name</label>
          <input id={`${id}-name`} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Northwind rebrand" aria-describedby={`${id}-hint`} className={`${inputClass} font-normal`} />
          <span id={`${id}-hint`} className="text-xs text-ink-soft">Leave blank to call it “Untitled project”. You can rename it any time.</span>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink-strong">Where do you want to start?</legend>
          {STARTS.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-checked:border-accent has-checked:bg-accent-wash">
              <input type="radio" name="start" value={s.value} checked={start === s.value} onChange={() => setStart(s.value)} className="mt-1 accent-accent" />
              <span><span className="block font-semibold text-ink-strong">{s.label}</span><span className="block text-sm text-ink-soft">{s.hint}</span></span>
            </label>
          ))}
        </fieldset>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  )
}
