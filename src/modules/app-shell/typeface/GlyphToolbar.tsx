import type { ReactNode } from 'react'
import { AddPointIcon, DeletePointIcon, FitIcon, GhostIcon, GuidesIcon, HandIcon, PointerIcon, RedoIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from '@/modules/shared-ui'
import type { Tool } from '@/modules/glyph-editor/GlyphCanvas'

const btn =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-sheet-deep disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-accent-wash aria-pressed:text-accent-strong md:min-h-9 md:min-w-9'

function ToolButton({ label, icon, text, pressed, disabled, onClick, shortcut, note }: { label: string; icon: ReactNode; text?: string; pressed?: boolean; disabled?: boolean; onClick: () => void; shortcut?: string; note?: string | undefined }) {
  return (
    <button type="button" aria-label={label} title={note ?? (shortcut ? `${label} (${shortcut})` : label)} aria-pressed={pressed} aria-keyshortcuts={shortcut} disabled={disabled} onClick={onClick} className={btn}>
      {icon}
      {text ? <span className="hidden sm:inline">{text}</span> : null}
    </button>
  )
}

const Divider = () => <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />

export interface GlyphToolbarProps {
  tool: Tool
  onTool: (t: Tool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  canInsert: boolean
  canDelete: boolean
  onInsert: () => void
  onDelete: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  snap: number
  onSnap: (v: number) => void
  guides: boolean
  onGuides: (v: boolean) => void
  ghost: boolean
  ghostAvailable: boolean
  onGhost: (v: boolean) => void
  /** Why adding and deleting points is unavailable, when the plan leaves it out. */
  structureNote?: string | undefined
  structureHidden?: boolean
}

/** Every canvas action is a button here as well as a key, so nothing depends on a mouse or on remembering a shortcut. */
export function GlyphToolbar(p: GlyphToolbarProps) {
  return (
    <div role="toolbar" aria-label="Outline tools" className="flex flex-wrap items-center gap-x-0.5 gap-y-1 rounded-md border border-line bg-paper px-1.5 py-1">
      <ToolButton label="Select and move points" icon={<PointerIcon />} text="Select" pressed={p.tool === 'select'} onClick={() => p.onTool('select')} />
      <ToolButton label="Pan the view" icon={<HandIcon />} text="Pan" pressed={p.tool === 'pan'} onClick={() => p.onTool('pan')} shortcut="Space" />
      <Divider />
      <ToolButton label="Undo" icon={<UndoIcon />} disabled={!p.canUndo} onClick={p.onUndo} shortcut="Control+Z" />
      <ToolButton label="Redo" icon={<RedoIcon />} disabled={!p.canRedo} onClick={p.onRedo} shortcut="Control+Shift+Z" />
      <Divider />
      {p.structureHidden ? null : (
        <>
          <ToolButton label="Insert a point after the selected point" icon={<AddPointIcon />} disabled={!p.canInsert || !!p.structureNote} onClick={p.onInsert} shortcut="I" note={p.structureNote} />
          <ToolButton label="Delete the selected points" icon={<DeletePointIcon />} disabled={!p.canDelete || !!p.structureNote} onClick={p.onDelete} shortcut="Delete" note={p.structureNote} />
          <Divider />
        </>
      )}
      <ToolButton label="Zoom out" icon={<ZoomOutIcon />} onClick={p.onZoomOut} shortcut="-" />
      <output aria-label="Zoom" className="tnum min-w-12 text-center text-xs font-semibold text-ink-soft">{p.zoom}%</output>
      <ToolButton label="Zoom in" icon={<ZoomInIcon />} onClick={p.onZoomIn} shortcut="+" />
      <ToolButton label="Fit the glyph in the view" icon={<FitIcon />} onClick={p.onFit} shortcut="0" />
      <Divider />
      <label className="flex min-h-11 items-center gap-1.5 px-1.5 text-sm font-semibold text-ink md:min-h-9">
        Snap
        <select value={p.snap} onChange={(e) => p.onSnap(Number(e.target.value))} className="min-h-9 rounded-md border border-line-strong bg-paper px-1.5 text-sm font-normal focus:border-accent md:min-h-8">
          <option value={0}>Off</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </label>
      <ToolButton label="Metric guides" icon={<GuidesIcon />} pressed={p.guides} onClick={() => p.onGuides(!p.guides)} />
      <ToolButton label="Generated shape, dashed" icon={<GhostIcon />} pressed={p.ghost && p.ghostAvailable} disabled={!p.ghostAvailable} onClick={() => p.onGhost(!p.ghost)} />
    </div>
  )
}
