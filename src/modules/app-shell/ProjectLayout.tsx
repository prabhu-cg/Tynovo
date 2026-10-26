import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { downloadBytes } from '@/modules/font-export/download'
import { useProjectFont } from '@/modules/font-export/useProjectFont'
import { Banner, Button, ButtonLink } from '@/modules/shared-ui'
import { AppSeo } from '@/modules/marketing/Seo'
import type { DraftGuard } from './project'
import { exportProjectFile } from './projectFile'
import { SaveStatus } from './SaveStatus'
import { useProjectFonts } from './useProjectFonts'
import { useStudio } from './studio'
import { useProjectEditor } from './useProjectEditor'
import { describeError } from './errors'

const tab = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors md:min-h-10 ${isActive ? 'border-accent text-ink-strong' : 'border-transparent text-ink-soft hover:text-ink-strong'}`

/** Shared header, save status and error recovery for every section of a project. */
export function ProjectLayout() {
  const { projectId = '' } = useParams()
  const { service } = useStudio()
  const navigate = useNavigate()
  const editor = useProjectEditor(service, projectId)
  const { draft, state } = editor
  // Registered once for the whole project, so Typography, Export and the typeface views all see the same font.
  const customFont = useProjectFont(draft?.customTypeface ?? null)
  const fonts = useProjectFonts(draft)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  const [searchParams] = useSearchParams()
  const wide = searchParams.has('glyph')

  // Unapplied work in the current screen (an outline being edited). It is asked about, never saved or dropped on its own.
  const guardRef = useRef<DraftGuard | null>(null)
  const [guard, setGuardState] = useState<DraftGuard | null>(null)
  const guardDirty = guard !== null
  const setGuard = useCallback((g: DraftGuard | null) => {
    guardRef.current = g
    setGuardState(g)
  }, [])

  const unsafe = state !== 'saved' && copyId === null
  const unsafeRef = useRef(unsafe)
  useEffect(() => {
    unsafeRef.current = unsafe
  })
  const shouldBlock = useCallback(() => guardRef.current !== null || unsafeRef.current, [])
  const blocker = useBlocker(shouldBlock)
  const blockedByDraft = blocker.state === 'blocked' && guardDirty

  // Leaving while a save is pending: save first, then go. Only stay put if saving fails.
  // Unapplied outline work is different: wait for the person to choose (see the banner below).
  useEffect(() => {
    if (blocker.state !== 'blocked' || blockedByDraft) return
    let live = true
    void editor.flush().then((ok) => live && ok && blocker.proceed())
    return () => {
      live = false
    }
  }, [blocker, blockedByDraft, editor.flush]) // eslint-disable-line

  const leaveAfter = (act: () => void) => {
    act()
    setGuard(null)
    void editor.flush().then((ok) => ok && blocker.state === 'blocked' && blocker.proceed())
  }

  useEffect(() => {
    if (copyId) void navigate(`/app/projects/${copyId}`)
  }, [copyId, navigate])

  useEffect(() => {
    if (state === 'saved' && !guardDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state, guardDirty])

  if (editor.load === 'loading') {
    return <p className="text-ink-soft" role="status"><AppSeo title="Project" />Opening project…</p>
  }
  if (editor.load !== 'ready' || !draft) {
    return (
      <div className="mx-auto max-w-3xl">
        <AppSeo title="Project not available" />
        <Banner tone="error" actions={<ButtonLink to="/app/projects">Back to projects</ButtonLink>}>
          {editor.load === 'missing' ? 'This project does not exist. It may have been deleted, or it was created in another browser.' : editor.loadError}
        </Banner>
      </div>
    )
  }

  const saveCopy = async () => {
    try {
      const copy = await service.saveAsCopy(draft)
      setCopyId(copy.id)
    } catch (e) {
      setCopyError(describeError(e))
    }
  }

  return (
    <div className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <AppSeo title={draft.name} />
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/app/projects" className="inline-flex min-h-8 items-center font-semibold text-accent-strong underline-offset-4 hover:underline">Projects</Link>
      </nav>

      <header className="mt-2 grid gap-4 pb-2">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <label className="grid min-w-0 flex-1 basis-72 gap-1">
            <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Project name</span>
            <input
              value={draft.name}
              maxLength={120}
              aria-label="Project name"
              onChange={(e) => editor.patch((p) => ({ ...p, name: e.target.value }))}
              className="-ml-2 w-[calc(100%+0.5rem)] min-w-0 rounded-md border border-transparent bg-transparent px-2 text-3xl font-extrabold tracking-tight text-ink-strong hover:border-line-strong focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SaveStatus state={state} lastSavedAt={editor.lastSavedAt} />
            {state === 'dirty' || state === 'error' || state === 'invalid' ? <Button onClick={() => void editor.flush()}>Save now</Button> : null}
            <ButtonLink to="export" variant="secondary">Export</ButtonLink>
            <ButtonLink to="settings" variant="ghost">Settings</ButtonLink>
          </div>
        </div>
        <nav aria-label="Project sections" className="-mb-px flex gap-5 overflow-x-auto border-b border-line">
          <NavLink to="." end className={tab}>Overview</NavLink>
          <NavLink to="fonts" className={tab}>Font catalog</NavLink>
          <NavLink to="typography" className={tab}><span className="sr-only md:not-sr-only">Brand Typography System</span><span aria-hidden="true" className="md:hidden">Typography</span></NavLink>
          <NavLink to="typeface" className={tab}><span className="sr-only md:not-sr-only">Custom Typeface Creator</span><span aria-hidden="true" className="md:hidden">Typeface</span></NavLink>
        </nav>
      </header>

      <div className="mt-4 grid gap-3 empty:hidden">
        {editor.migration ? (
          <Banner
            tone="info"
            actions={<Button onClick={() => downloadBytes(new TextEncoder().encode(editor.migration!.originalJson), `${draft.id}.before-upgrade.json`, 'application/json')}>Download the original</Button>}
          >
            <strong>This project was saved in an older format (version {editor.migration.from}) and was upgraded to version {draft.schemaVersion} when it opened.</strong> The stored copy is replaced by the upgraded one the first time you save. Keep the original if you may want it.
          </Banner>
        ) : null}
        {state === 'error' ? (
          <Banner
            tone="error"
            actions={
              <>
                <Button onClick={() => void editor.flush()}>Try again</Button>
                <Button onClick={() => exportProjectFile(draft)}>Download project file</Button>
              </>
            }
          >
            <strong>Could not save.</strong> {editor.error} Your edits are still on this screen. Download the project file to keep a copy while you sort it out.
          </Banner>
        ) : null}
        {state === 'conflict' ? (
          <Banner
            tone="error"
            actions={
              <>
                <Button onClick={() => void saveCopy()}>Save mine as a copy</Button>
                <Button onClick={() => void editor.reload()}>Load the latest (discard mine)</Button>
              </>
            }
          >
            <strong>This project was changed somewhere else</strong> (another tab?). Autosave is paused so nothing is overwritten. {copyError}
          </Banner>
        ) : null}
        {state === 'invalid' ? <Banner tone="warn">{editor.error}</Banner> : null}
        {blockedByDraft ? (
          <Banner
            tone="warn"
            actions={
              <>
                <Button onClick={() => blocker.reset()}>Keep editing</Button>
                <Button onClick={() => leaveAfter(() => guard?.apply())}>Apply and leave</Button>
                <Button variant="danger" onClick={() => leaveAfter(() => guard?.discard())}>Discard and leave</Button>
              </>
            }
          >
            <strong>{guard?.describe() ?? 'You have changes that are not applied.'}</strong> Leaving now would lose them unless you apply them first.
          </Banner>
        ) : null}
        {blocker.state === 'blocked' && !blockedByDraft && (state === 'error' || state === 'conflict' || state === 'invalid') ? (
          <Banner
            tone="warn"
            actions={
              <>
                <Button onClick={() => blocker.reset()}>Stay</Button>
                <Button onClick={() => exportProjectFile(draft)}>Download project file</Button>
                <Button variant="danger" onClick={() => blocker.proceed()}>Leave without saving</Button>
              </>
            }
          >
            Your latest changes are not saved. Leaving now would lose them.
          </Banner>
        ) : null}
      </div>

      <div className="mt-8">
        <Outlet context={{ draft, editor, customFont, fonts, setGuard }} />
      </div>
    </div>
  )
}
