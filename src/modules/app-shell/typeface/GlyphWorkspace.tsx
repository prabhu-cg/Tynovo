import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import type { Contour } from '@/modules/brand-projects/schema'
import { validateGlyph } from '@/modules/font-validation/glyphs'
import { appliedDraft, applyDraft, asGlyph, draftFixes, generatedDraft, leftBearingOf, rightBearingOf, contextText, withAdvance, withLeftBearing, withRightBearing, type DraftFix } from '@/modules/glyph-editor/draft'
import { GlyphCanvas, type CanvasCommand, type Tool } from '@/modules/glyph-editor/GlyphCanvas'
import { GlyphThumb } from '@/modules/glyph-editor/GlyphThumb'
import { allKeys, contourKeys, deletePoints, insertPointAfter, insertPointAt, movePoints, parseKey, pointKey, setPoint, stepContour, stepPoint, type Selection } from '@/modules/glyph-editor/outline'
import { draftOf, isDirty, openSession, reduce, sameDraft, type Draft } from '@/modules/glyph-editor/session'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { useViewport } from '@/modules/glyph-editor/useViewport'
import { toScreen, zoomPercent } from '@/modules/glyph-editor/viewport'
import { TARGET_CHARS } from '@/modules/typeface-engine/charset'
import { deriveMetrics } from '@/modules/typeface-engine/dna'
import { freezeGlyph, resetGlyph, setGlyphOutline, setGlyphParams, setGlyphSpacing } from '@/modules/typeface-engine/edit'
import { Banner, Button, ChevronLeftIcon, ChevronRightIcon } from '@/modules/shared-ui'
import { useProject } from '../project'
import { lockedMessage, whenLocked } from '@/modules/entitlements'
import { useCapabilities } from '../entitlements'
import { GlyphInspector } from './GlyphInspector'
import { GlyphToolbar } from './GlyphToolbar'
import type { TypefaceHandle } from './useTypeface'

const show = (c: string) => (c === ' ' ? 'space' : c)

const SHORTCUTS: Array<[string, string]> = [
  ['Arrow keys', 'Move the selected points by 1 unit (Shift: 10). With nothing selected, pan the view.'],
  ['[  and  ]', 'Select the previous or next point.'],
  ['{  and  }', 'Select the previous or next contour.'],
  ['I or Enter', 'Insert a point after the selected point.'],
  ['Delete', 'Remove the selected points.'],
  ['Escape', 'Clear the selection.'],
  ['Ctrl/Cmd + A', 'Select every point.'],
  ['Ctrl/Cmd + Z, Shift + Z', 'Undo and redo.'],
  ['+  -  0', 'Zoom in, zoom out, fit the glyph.'],
  ['Space + drag', 'Pan the view. Ctrl/Cmd + wheel or a pinch zooms.'],
  ['Double-click an edge', 'Insert a point there.'],
  ['Shift + click or drag', 'Add to the selection. Shift while dragging keeps to one axis.'],
]

function describeSelection(contours: Contour[], selection: Selection): string {
  if (selection.size === 0) return 'No point selected.'
  if (selection.size > 1) return `${selection.size} points selected.`
  const { c, p } = parseKey([...selection][0]!)
  const pt = contours[c]?.[p]
  return pt ? `Point ${p + 1} of ${contours[c]!.length} in contour ${c + 1} of ${contours.length}: x ${pt.x}, y ${pt.y}.` : 'No point selected.'
}

export function GlyphWorkspace({ handle, char, onNavigate }: { handle: TypefaceHandle; char: string; onNavigate: (char: string | null) => void }) {
  const applied = appliedDraft(handle.face, char)
  if (!applied) {
    return (
      <div className="grid max-w-xl gap-4">
        <Button className="justify-self-start" onClick={() => onNavigate(null)}><ChevronLeftIcon />All glyphs</Button>
        <Banner tone="info">{show(char)} has no design yet in this engine version, so there is nothing to edit and it is not in the font.</Banner>
      </div>
    )
  }
  return <Editor key={char} handle={handle} char={char} applied={applied} onNavigate={onNavigate} />
}

function Editor({ handle, char, applied, onNavigate }: { handle: TypefaceHandle; char: string; applied: Draft; onNavigate: (char: string | null) => void }) {
  const { face, update } = handle
  const { setGuard } = useProject()
  const metrics = deriveMetrics(face.dna)
  const [session, dispatch] = useReducer(reduce, undefined, () => openSession(char, applied))
  // The project changed under a clean editor (a shape setting, a reset): follow it.
  if (!isDirty(session) && !sameDraft(session.applied, applied)) dispatch({ type: 'reload', draft: applied })

  const draft = draftOf(session)
  const dirty = isDirty(session)
  const { selection } = session
  const override = face.overrides[char]
  const frozen = !!override?.contours
  const generated = useMemo(() => generatedDraft(face, char), [face, char])
  const canReset = !!generated && !sameDraft(draft, generated)
  const ghostAvailable = !!generated && (frozen || dirty)

  const [tool, setTool] = useState<Tool>('select')
  const [guides, setGuides] = useState(true)
  const [ghostOn, setGhostOn] = useState(true)
  const [snap, setSnap] = useState(0)
  const [note, setNote] = useState('')

  const [confirm, setConfirm] = useState<{ to: string | null } | null>(null)
  const [box] = useState(() => ({ minX: -80, maxX: Math.max(applied.advanceWidth, ...applied.contours.flat().map((p) => p.x)) + 80, minY: metrics.descender - 40, maxY: metrics.ascender + 40 }))
  const viewport = useViewport(box)
  const helpId = useId()

  const issues = useMemo(() => validateGlyph(asGlyph(char, draft), metrics), [char, draft, metrics.ascender, metrics.descender]) // eslint-disable-line
  const fixes = useMemo(() => draftFixes(new Set(issues.map((i) => i.code)), draft, face.dna.sidebearing), [issues, draft, face.dna.sidebearing])

  const sessionRef = useRef(session)
  const applyNow = () => {
    const d = draftOf(sessionRef.current)
    update((f) => applyDraft(f, char, d))
    dispatch({ type: 'applied', draft: d })
    setNote('Changes applied to the project.')
  }
  const discardNow = () => {
    dispatch({ type: 'revert', now: Date.now() })
    setNote('Changes discarded. Undo brings them back.')
  }
  const applyRef = useRef(applyNow)
  const discardRef = useRef(discardNow)
  // Handlers outside React (the router’s leave prompt) must see the latest session.
  useEffect(() => {
    sessionRef.current = session
    applyRef.current = applyNow
    discardRef.current = discardNow
  })

  // While there are unapplied changes, leaving this screen asks first (see ProjectLayout).
  useEffect(() => {
    if (!dirty) return
    setGuard({ describe: () => `Glyph ${show(char)} has outline changes that are not applied.`, isDirty: () => true, apply: () => applyRef.current(), discard: () => discardRef.current() })
    return () => setGuard(null)
  }, [dirty, char, setGuard])

  const commit = (next: Draft, opts: { coalesce?: string; selection?: Selection } = {}) =>
    dispatch({ type: 'commit', draft: next, now: Date.now(), ...(opts.coalesce ? { coalesce: opts.coalesce } : {}), ...(opts.selection ? { selection: opts.selection } : {}) })
  const select = (s: Selection) => dispatch({ type: 'select', selection: s })
  const withContours = (contours: Contour[]): Draft => ({ ...draft, contours })

  const single = selection.size === 1 ? parseKey([...selection][0]!) : null

  const reveal = (c: number, p: number) => {
    const pt = draft.contours[c]?.[p]
    const { view, size } = viewport
    if (!pt || !view || !size) return
    const s = toScreen(view, size, pt.x, pt.y)
    const margin = 48
    if (s.px < margin || s.px > size.w - margin || s.py < margin || s.py > size.h - margin) viewport.pan(size.w / 2 - s.px, size.h / 2 - s.py)
  }

  // Capability and presentation are separate: `can*` decides whether an edit may happen (every route to it checks), `*Hidden` only decides whether its control is drawn.
  const caps = useCapabilities()
  const canStructure = caps.allows('glyph.edit.structure')
  const canShape = caps.allows('glyph.edit.shape-params')
  const structureNote = canStructure ? undefined : lockedMessage('glyph.edit.structure', caps)
  const shapeNote = canShape ? undefined : lockedMessage('glyph.edit.shape-params', caps)
  const structureHidden = !canStructure && whenLocked('glyph.edit.structure') === 'hide'
  const shapeHidden = !canShape && whenLocked('glyph.edit.shape-params') === 'hide'

  const run = (cmd: CanvasCommand) => {
    if ((cmd.type === 'insert' || cmd.type === 'delete') && !canStructure) return setNote(structureNote ?? '')
    switch (cmd.type) {
      case 'nudge':
        if (selection.size === 0) viewport.pan(-cmd.dx * 40, cmd.dy * 40)
        else commit(withContours(movePoints(draft.contours, selection, cmd.dx, cmd.dy)), { coalesce: 'nudge' })
        return
      case 'delete': {
        const r = deletePoints(draft.contours, selection)
        if (!r.ok) return setNote(r.reason)
        commit(withContours(r.contours), { selection: r.selection })
        return setNote(selection.size > 1 ? 'Points deleted.' : 'Point deleted.')
      }
      case 'insert': {
        if (!single) return setNote('Select one point first. The new point goes after it.')
        const r = insertPointAfter(draft.contours, single.c, single.p)
        if (!r.ok) return setNote(r.reason)
        commit(withContours(r.contours), { selection: r.selection })
        return setNote('Point inserted and selected.')
      }
      case 'point': {
        const next = stepPoint(draft.contours, single, cmd.dir)
        if (!next) return
        select(new Set([pointKey(next.c, next.p)]))
        return reveal(next.c, next.p)
      }
      case 'contour': {
        const next = stepContour(draft.contours, single?.c ?? (selection.size ? parseKey([...selection][0]!).c : null), cmd.dir)
        if (next === null) return
        return select(contourKeys(draft.contours, next))
      }
      case 'selectAll':
        return select(allKeys(draft.contours))
      case 'clear':
        return select(new Set())
      case 'undo':
        dispatch({ type: 'undo' })
        return setNote('Undone.')
      case 'redo':
        dispatch({ type: 'redo' })
        return setNote('Redone.')
      case 'zoom':
        return viewport.zoom(cmd.factor)
      case 'fit':
        return viewport.fit()
    }
  }

  // Leaving this glyph (back, previous, next) with unapplied work asks first.
  const go = (to: string | null) => {
    if (dirty) setConfirm({ to })
    else onNavigate(to)
  }
  const leave = (to: string | null) => {
    setGuard(null)
    onNavigate(to)
  }

  const editable = useMemo(() => [...TARGET_CHARS].filter((c) => c !== ' ' && appliedDraft(face, c) !== null), [face])
  const at = editable.indexOf(char)
  const prev = at > 0 ? editable[at - 1] : undefined
  const next = at >= 0 && at < editable.length - 1 ? editable[at + 1] : undefined

  const parametric = !frozen && !dirty
  const hasSpacingOverride = !!override && (override.leftBearing !== undefined || override.rightBearing !== undefined || override.advanceWidth !== undefined)
  const previewFace = useMemo(() => setGlyphOutline(face, char, draft.contours, draft.advanceWidth), [face, char, draft])
  const ghost = ghostOn && ghostAvailable ? generated!.contours : null
  const state = dirty ? 'Unapplied changes' : frozen ? 'Hand-edited outline' : 'Generated shape'

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={() => go(null)}><ChevronLeftIcon />All glyphs</Button>
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-extrabold text-ink-strong" aria-label={`Glyph ${show(char)}`}>{show(char)}</h2>
          <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${dirty ? 'text-accent-strong' : 'text-ink-soft'}`} role="status">
            {dirty ? <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> : null}
            {state}
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Neighbouring glyphs">
          <Button variant="ghost" disabled={!prev} aria-label={prev ? `Previous glyph, ${show(prev)}` : 'No previous glyph'} onClick={() => prev && go(prev)}><ChevronLeftIcon /></Button>
          <Button variant="ghost" disabled={!next} aria-label={next ? `Next glyph, ${show(next)}` : 'No next glyph'} onClick={() => next && go(next)}><ChevronRightIcon /></Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={discardNow}>Discard changes</Button>
          <Button variant="primary" disabled={!dirty} onClick={applyNow}>Apply changes</Button>
        </div>
      </div>

      <nav aria-label="Alphabet overview" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex gap-1">
          {editable.map((c) => {
            const d = c === char ? draft : appliedDraft(face, c)!
            return (
              <li key={c} className="shrink-0">
                <button
                  type="button"
                  aria-label={`Edit ${show(c)}`}
                  aria-current={c === char ? 'true' : undefined}
                  ref={(el) => { if (el && c === char) el.scrollIntoView?.({ inline: 'center', block: 'nearest' }) }}
                  onClick={() => c !== char && go(c)}
                  className={`grid h-12 w-9 cursor-pointer place-items-center rounded-md border p-0.5 transition-colors ${c === char ? 'border-accent bg-accent-wash' : 'border-line bg-paper hover:border-ink'}`}
                >
                  <GlyphThumb glyph={asGlyph(c, d)} metrics={metrics} guides={false} />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {confirm ? (
        <Banner
          tone="warn"
          actions={
            <>
              <Button onClick={() => setConfirm(null)}>Keep editing</Button>
              <Button onClick={() => { applyNow(); leave(confirm.to) }}>Apply and continue</Button>
              <Button variant="danger" onClick={() => { discardNow(); leave(confirm.to) }}>Discard and continue</Button>
            </>
          }
        >
          <strong>Glyph {show(char)} has changes that are not applied.</strong> Apply them to the project, or discard them, before moving on.
        </Banner>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="grid min-w-0 gap-3">
          <GlyphToolbar
            tool={tool}
            onTool={setTool}
            canUndo={session.history.past.length > 0}
            canRedo={session.history.future.length > 0}
            onUndo={() => run({ type: 'undo' })}
            onRedo={() => run({ type: 'redo' })}
            canInsert={selection.size === 1 && canStructure}
            canDelete={selection.size > 0 && canStructure}
            structureNote={structureNote}
            structureHidden={structureHidden}
            onInsert={() => run({ type: 'insert' })}
            onDelete={() => run({ type: 'delete' })}
            zoom={viewport.view ? zoomPercent(viewport.view) : 100}
            onZoomIn={() => run({ type: 'zoom', factor: 1.25 })}
            onZoomOut={() => run({ type: 'zoom', factor: 0.8 })}
            onFit={() => run({ type: 'fit' })}
            snap={snap}
            onSnap={setSnap}
            guides={guides}
            onGuides={setGuides}
            ghost={ghostOn}
            ghostAvailable={ghostAvailable}
            onGhost={setGhostOn}
          />
          <div className="h-[clamp(22rem,64dvh,46rem)] min-w-0 overflow-hidden rounded-md border border-line">
            <GlyphCanvas
              label={`Outline of ${show(char)}`}
              contours={draft.contours}
              advanceWidth={draft.advanceWidth}
              metrics={metrics}
              ghost={ghost}
              selection={selection}
              tool={tool}
              guides={guides}
              snap={snap}
              viewport={viewport}
              helpId={helpId}
              onSelect={select}
              onLive={(contours) => dispatch({ type: 'live', draft: withContours(contours) })}
              onGestureEnd={(base) => dispatch({ type: 'endGesture', base: { contours: base, advanceWidth: draft.advanceWidth }, now: Date.now() })}
              onInsertAt={(c, p, x, y) => {
                if (!canStructure) return setNote(structureNote ?? '')
                const r = insertPointAt(draft.contours, c, p, x, y)
                if (!r.ok) return setNote(r.reason)
                commit(withContours(r.contours), { selection: r.selection })
                setNote('Point inserted and selected.')
              }}
              onCommand={run}
            />
          </div>
          <p id={helpId} className="sr-only">Outline editor. Arrow keys move selected points. Left and right square brackets choose the previous or next point. Delete removes points, I inserts one, Control Z undoes. The full list of keys follows the editor.</p>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 text-sm">
            <p role="status" aria-live="polite" className="tnum text-ink">{describeSelection(draft.contours, selection)}</p>
            <p role="status" aria-live="polite" className="text-ink-soft">{note}</p>
          </div>
          <p className="text-xs text-ink-soft">Square markers are points; the round one starts each contour. Dashed outline: the generated shape.</p>
          <details className="rounded-md border border-line bg-paper px-3 py-2 text-sm">
            <summary className="min-h-8 cursor-pointer font-semibold text-ink-strong">Keyboard and pointer controls</summary>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-ink-strong">{k}</dt>
                  <dd className="text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          <section aria-labelledby="ctx-h" className="rounded-md border border-line bg-paper p-4">
            <h3 id="ctx-h" className="text-sm font-bold text-ink-strong">In context</h3>
            <p className="mb-2 text-xs text-ink-soft">{show(char)} between straight stems and rounds, drawn from the working copy. Editor preview, not the exported file.</p>
            <SpecimenSvg face={previewFace} text={contextText(char)} guides={false} label={`${show(char)} in context`} />
          </section>
        </div>

        <aside aria-label={`Inspector for ${show(char)}`} className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <GlyphInspector
            face={face}
            char={char}
            contours={draft.contours}
            selection={selection}
            issues={issues}
            fixes={fixes}
            onFix={(f: DraftFix) => commit(f.apply(draft))}
            onSetPoint={(c, p, x, y) => commit(withContours(setPoint(draft.contours, c, p, x, y)), { coalesce: `pt-${c}-${p}` })}
            onStepPoint={(dir) => run({ type: 'point', dir })}
            onInsert={() => run({ type: 'insert' })}
            onDelete={() => run({ type: 'delete' })}
            mode={parametric ? 'parametric' : 'outline'}
            advance={draft.advanceWidth}
            left={leftBearingOf(draft)}
            right={rightBearingOf(draft)}
            onAdvance={(v) => (parametric ? update((f) => setGlyphSpacing(f, char, { advanceWidth: v })) : commit(withAdvance(draft, v), { coalesce: 'advance' }))}
            onLeft={(v) => (parametric ? update((f) => setGlyphSpacing(f, char, { leftBearing: v })) : commit(withLeftBearing(draft, v), { coalesce: 'left' }))}
            onRight={(v) => (parametric ? update((f) => setGlyphSpacing(f, char, { rightBearing: v })) : commit(withRightBearing(draft, v), { coalesce: 'right' }))}
            hasSpacingOverride={hasSpacingOverride}
            onFollowSpacing={() => update((f) => setGlyphSpacing(f, char, { leftBearing: undefined, rightBearing: undefined, advanceWidth: undefined }))}
            frozen={frozen}
            dirty={dirty}
            canReset={canReset}
            onReset={() => {
              if (!generated) return
              commit(generated)
              setNote('Reset to the generated shape. Apply to keep it.')
            }}
            onLock={() => update((f) => freezeGlyph(f, char))}
            hasOverrides={!!override}
            onResetAll={() => {
              dispatch({ type: 'revert', now: Date.now() })
              update((f) => resetGlyph(f, char))
              setNote('Every override on this glyph was removed.')
            }}
            onParam={(key, value) => canShape && update((f) => setGlyphParams(f, char, { [key]: value }))}
            structureNote={structureNote}
            structureHidden={structureHidden}
            shapeNote={shapeNote}
            shapeHidden={shapeHidden}
          />
        </aside>
      </div>
    </div>
  )
}
