import { useCallback, useRef, useState } from 'react'

/** Width in CSS pixels of an element, kept current by a ResizeObserver. Returns a ref callback to attach. */
export function useElementWidth(): [number, (el: Element | null) => void] {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: Element | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width))
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure)
      observer.current.observe(el)
    }
  }, [])
  return [width, ref]
}
