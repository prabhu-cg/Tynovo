import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * A new page opens at its top, or at its #anchor. Back and forward are left to the browser, which restores the
 * position itself. Nothing is stored anywhere: the position is never saved by the app. Only a change of page or
 * anchor counts, so switching a tab or a search parameter on the same page does not jump.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type === 'POP') return
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash, type])
  return null
}
