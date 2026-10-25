import { useCallback, useRef, useState } from 'react'
import { fitView, panBy, zoomAt, type Box, type Size, type View } from './viewport'

/**
 * Pan and zoom state for a canvas. Until the person zooms or pans the view simply fits `box`; "fit" returns to that.
 * The canvas element is measured with a ResizeObserver (an external system), not with effects that set state.
 */
export function useViewport(box: Box) {
  const [size, setSize] = useState<Size | null>(null)
  const [custom, setCustom] = useState<View | null>(null)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((el: Element | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure)
      observer.current.observe(el)
    }
  }, [])

  const view = custom ?? (size ? fitView(size, box) : null)

  const zoom = useCallback(
    (factor: number, px?: number, py?: number) => {
      if (!size || !view) return
      setCustom(zoomAt(view, size, factor, px ?? size.w / 2, py ?? size.h / 2))
    },
    [size, view],
  )
  const pan = useCallback(
    (dxPx: number, dyPx: number) => {
      if (view) setCustom(panBy(view, dxPx, dyPx))
    },
    [view],
  )
  const fit = useCallback(() => setCustom(null), [])

  return { ref, size, view, isFit: custom === null, zoom, pan, fit }
}

export type Viewport = ReturnType<typeof useViewport>
