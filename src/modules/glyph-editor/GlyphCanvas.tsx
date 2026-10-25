import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Contour, FontMetrics } from '@/modules/brand-projects/schema'
import { glyphToSvgPath } from './geometry'
import { movePoints, nearestPoint, nearestSegment, parseKey, pointKey, pointsInRect, type Selection } from './outline'
import { toWorld, viewBox } from './viewport'
import type { Viewport } from './useViewport'

export type CanvasCommand =
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'delete' }
  | { type: 'insert' }
  | { type: 'point'; dir: 1 | -1 }
  | { type: 'contour'; dir: 1 | -1 }
  | { type: 'selectAll' }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'zoom'; factor: number }
  | { type: 'fit' }

export type Tool = 'select' | 'pan'

export interface GlyphCanvasProps {
  label: string
  contours: Contour[]
  advanceWidth: number
  metrics: FontMetrics
  /** The generated shape, drawn dashed behind the outline for comparison. */
  ghost: Contour[] | null
  selection: Selection
  tool: Tool
  guides: boolean
  /** Snap grid in font units; 0 is off. */
  snap: number
  viewport: Viewport
  helpId: string
  onSelect: (selection: Selection) => void
  /** Called with every intermediate state of a drag. */
  onLive: (contours: Contour[]) => void
  /** Called when a drag ends, with the outline as it was when the drag began. */
  onGestureEnd: (base: Contour[]) => void
  onInsertAt: (c: number, p: number, x: number, y: number) => void
  onCommand: (command: CanvasCommand) => void
}

const POINT_PX = 8
const HIT_PX = 11
const SEGMENT_PX = 9

interface DragGesture {
  kind: 'drag'
  base: Contour[]
  selection: Selection
  anchor: { x: number; y: number }
  start: { x: number; y: number }
  startPx: { x: number; y: number }
  moved: boolean
  hit: string
  shift: boolean
}
interface PanGesture { kind: 'pan'; lastX: number; lastY: number }
interface MarqueeGesture { kind: 'marquee'; start: { x: number; y: number }; startPx: { x: number; y: number }; additive: boolean; before: Selection; moved: boolean }
type Gesture = DragGesture | PanGesture | MarqueeGesture

const snapTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : Math.round(v))

/**
 * The editing surface: outline, guides, points, selection, drag, marquee, pan and zoom, and the keyboard map.
 * It owns no document state. Changes go out through callbacks, so the same commands also work from buttons.
 */
export function GlyphCanvas(props: GlyphCanvasProps) {
  const { contours, advanceWidth, metrics, ghost, selection, tool, guides, snap, viewport, helpId } = props
  const { view, size } = viewport
  const svgRef = useRef<SVGSVGElement | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const clipId = useId()
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

  const attach = viewport.ref
  const setRef = useCallback((el: SVGSVGElement | null) => {
    svgRef.current = el
    attach(el)
  }, [attach])

  const outline = useMemo(() => glyphToSvgPath(contours), [contours])
  const ghostPath = useMemo(() => (ghost ? glyphToSvgPath(ghost) : null), [ghost])

  // Ctrl/Cmd + wheel (also what a trackpad pinch sends) zooms; a plain wheel scrolls the page as usual.
  const zoomRef = useRef(viewport.zoom)
  useEffect(() => {
    zoomRef.current = viewport.zoom
  })
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomRef.current(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (!view || !size) {
    // The first render has no measurements yet; the ref callback supplies them right after mount.
    return <svg ref={setRef} className="block h-full w-full" aria-label={props.label} />
  }
  const upp = view.upp
  const px = (n: number) => n * upp

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const world = (e: { clientX: number; clientY: number }) => {
    const l = local(e)
    return toWorld(view, size, l.x, l.y)
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return
    svgRef.current?.focus({ preventScroll: true })
    const l = local(e)
    const w = toWorld(view, size, l.x, l.y)
    const panNow = tool === 'pan' || e.button === 1 || spaceDown
    const target = (e.target as Element).closest('[data-pt]') as SVGElement | null
    svgRef.current!.setPointerCapture(e.pointerId)
    if (panNow) {
      gesture.current = { kind: 'pan', lastX: l.x, lastY: l.y }
      setPanning(true)
      return
    }
    if (target) {
      const key = target.dataset['pt']!
      const { c, p } = parseKey(key)
      const pt = contours[c]![p]!
      let next = selection
      if (e.shiftKey) {
        const s = new Set(selection)
        if (s.has(key)) s.delete(key)
        else s.add(key)
        next = s
      } else if (!selection.has(key)) next = new Set([key])
      if (next !== selection) props.onSelect(next)
      gesture.current = { kind: 'drag', base: contours, selection: next, anchor: { x: pt.x, y: pt.y }, start: w, startPx: l, moved: false, hit: key, shift: e.shiftKey }
      return
    }
    gesture.current = { kind: 'marquee', start: w, startPx: l, additive: e.shiftKey, before: selection, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    const l = local(e)
    if (g.kind === 'pan') {
      viewport.pan(l.x - g.lastX, l.y - g.lastY)
      g.lastX = l.x
      g.lastY = l.y
      return
    }
    const w = toWorld(view, size, l.x, l.y)
    if (g.kind === 'marquee') {
      if (!g.moved && Math.hypot(l.x - g.startPx.x, l.y - g.startPx.y) < 4) return
      g.moved = true
      setMarquee({ x1: g.start.x, y1: g.start.y, x2: w.x, y2: w.y })
      const inside = pointsInRect(contours, g.start.x, g.start.y, w.x, w.y)
      props.onSelect(g.additive ? new Set([...g.before, ...inside]) : inside)
      return
    }
    if (!g.moved && Math.hypot(l.x - g.startPx.x, l.y - g.startPx.y) < 3) return
    g.moved = true
    let dx = w.x - g.start.x
    let dy = w.y - g.start.y
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0
      else dx = 0
    }
    // The point being dragged lands on the snap grid; the rest of the selection moves by the same amount.
    const target = { x: snapTo(g.anchor.x + dx, snap), y: snapTo(g.anchor.y + dy, snap) }
    props.onLive(movePoints(g.base, g.selection, target.x - g.anchor.x, target.y - g.anchor.y))
  }

  const finish = () => {
    const g = gesture.current
    gesture.current = null
    setMarquee(null)
    setPanning(false)
    if (!g) return
    if (g.kind === 'drag') {
      if (g.moved) props.onGestureEnd(g.base)
      else if (!g.shift && g.selection.size > 1 && g.selection.has(g.hit)) props.onSelect(new Set([g.hit]))
    } else if (g.kind === 'marquee' && !g.moved && !g.additive) {
      props.onSelect(new Set())
    }
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'pan') return
    const w = world(e)
    if (nearestPoint(contours, w.x, w.y, px(HIT_PX))) return
    const hit = nearestSegment(contours, w.x, w.y, px(SEGMENT_PX))
    if (hit) props.onInsertAt(hit.c, hit.p, w.x, w.y)
  }

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const mod = e.ctrlKey || e.metaKey
    const step = e.shiftKey ? 10 : 1
    const cmd = (c: CanvasCommand) => {
      e.preventDefault()
      props.onCommand(c)
    }
    if (e.key === ' ' ) {
      e.preventDefault()
      setSpaceDown(true)
      return
    }
    if (mod && e.key.toLowerCase() === 'z') return cmd({ type: e.shiftKey ? 'redo' : 'undo' })
    if (mod && e.key.toLowerCase() === 'y') return cmd({ type: 'redo' })
    if (mod && e.key.toLowerCase() === 'a') return cmd({ type: 'selectAll' })
    if (mod) return
    switch (e.key) {
      case 'ArrowLeft': return cmd({ type: 'nudge', dx: -step, dy: 0 })
      case 'ArrowRight': return cmd({ type: 'nudge', dx: step, dy: 0 })
      case 'ArrowUp': return cmd({ type: 'nudge', dx: 0, dy: step })
      case 'ArrowDown': return cmd({ type: 'nudge', dx: 0, dy: -step })
      case 'Delete':
      case 'Backspace': return cmd({ type: 'delete' })
      case 'Enter':
      case 'i': return cmd({ type: 'insert' })
      case '[': return cmd({ type: 'point', dir: -1 })
      case ']': return cmd({ type: 'point', dir: 1 })
      case '{': return cmd({ type: 'contour', dir: -1 })
      case '}': return cmd({ type: 'contour', dir: 1 })
      case 'Escape': return cmd({ type: 'clear' })
      case '+':
      case '=': return cmd({ type: 'zoom', factor: 1.25 })
      case '-':
      case '_': return cmd({ type: 'zoom', factor: 0.8 })
      case '0': return cmd({ type: 'fit' })
    }
  }

  const lines: Array<{ y: number; name: string; strong?: boolean }> = [
    { y: metrics.ascender, name: 'ascender' },
    { y: metrics.capHeight, name: 'cap height' },
    { y: metrics.xHeight, name: 'x-height' },
    { y: 0, name: 'baseline', strong: true },
    { y: metrics.descender, name: 'descender' },
  ]
  const left = view.cx - (size.w * upp) / 2
  const right = view.cx + (size.w * upp) / 2
  const top = view.cy + (size.h * upp) / 2
  const bottom = view.cy - (size.h * upp) / 2
  const hit = px(coarse ? 16 : HIT_PX)
  // Dense outlines (the rounded family has 60-90 points a glyph) stay readable when zoomed out: small dots, larger when zoomed in.
  const half = px(upp > 1.2 ? 4 : upp > 0.6 ? 6 : POINT_PX) / 2
  const fontSize = px(11)

  return (
    <svg
      ref={setRef}
      viewBox={viewBox(view, size)}
      role="application"
      aria-roledescription="outline editor"
      aria-label={props.label}
      aria-describedby={helpId}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === ' ' && setSpaceDown(false)}
      onBlur={() => setSpaceDown(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`block h-full w-full touch-none select-none rounded-md bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${tool === 'pan' || spaceDown ? (panning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
    >
      <defs>
        <clipPath id={clipId}><rect x={left} y={-top} width={right - left} height={top - bottom} /></clipPath>
      </defs>

      {/* Space left and right of the advance box, so bearings are visible. */}
      <rect x={left} y={-top} width={Math.max(0, 0 - left)} height={top - bottom} fill="var(--color-sheet)" />
      <rect x={advanceWidth} y={-top} width={Math.max(0, right - advanceWidth)} height={top - bottom} fill="var(--color-sheet)" />

      {guides ? (
        <g clipPath={`url(#${clipId})`} fontSize={fontSize} fill="var(--color-ink-soft)">
          {lines.map((l) => (
            <g key={l.name}>
              <line x1={left} x2={right} y1={-l.y} y2={-l.y} stroke={l.strong ? 'var(--color-accent)' : 'var(--color-line-strong)'} strokeWidth={l.strong ? 1.5 : 1} strokeDasharray={l.strong ? undefined : '4 5'} vectorEffect="non-scaling-stroke" />
              <text x={left + px(8)} y={-l.y - px(5)} style={{ fontFeatureSettings: '"tnum"' }}>{l.name} {l.y}</text>
            </g>
          ))}
          <line x1={0} x2={0} y1={-top} y2={-bottom} stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={advanceWidth} x2={advanceWidth} y1={-top} y2={-bottom} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <text x={px(6)} y={-bottom - px(8)}>origin</text>
          <text x={advanceWidth + px(6)} y={-bottom - px(8)}>advance {advanceWidth}</text>
        </g>
      ) : null}

      <g transform="scale(1 -1)">
        {ghostPath ? <path d={ghostPath} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1.25} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" opacity={0.8} /> : null}
        <path d={outline} fill="var(--color-ink-strong)" fillOpacity={0.1} fillRule="nonzero" stroke="var(--color-ink-strong)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {contours.map((contour, c) =>
          contour.map((pt, p) => {
            const key = pointKey(c, p)
            const on = selection.has(key)
            return (
              <g key={key}>
                <circle data-pt={key} cx={pt.x} cy={pt.y} r={hit} fill="transparent" style={{ cursor: tool === 'select' ? 'pointer' : undefined }} />
                <rect
                  x={pt.x - half}
                  y={pt.y - half}
                  width={half * 2}
                  height={half * 2}
                  rx={p === 0 ? half : 0}
                  fill={on ? 'var(--color-accent)' : 'var(--color-paper)'}
                  stroke={on ? 'var(--color-accent-strong)' : 'var(--color-ink-strong)'}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              </g>
            )
          }),
        )}
        {marquee ? <rect x={Math.min(marquee.x1, marquee.x2)} y={Math.min(marquee.y1, marquee.y2)} width={Math.abs(marquee.x2 - marquee.x1)} height={Math.abs(marquee.y2 - marquee.y1)} fill="var(--color-accent)" fillOpacity={0.08} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
      </g>
    </svg>
  )
}
