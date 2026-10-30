import type { MouseEvent } from 'react'
import { Link, useLocation, useResolvedPath, type LinkProps } from 'react-router'
import { arriveAt } from '@/modules/shared-ui'

/**
 * A link to a step. To a place on the page you are already on (the same #anchor, so the address does not change) a
 * plain link does nothing visible; this one scrolls there, focuses the heading and washes the section instead.
 */
export function StepLink({ to, onClick, onNavigate, ...rest }: LinkProps & { onNavigate?: () => void }) {
  const here = useLocation()
  const target = useResolvedPath(to)
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    onNavigate?.()
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (target.hash && target.pathname === here.pathname && target.hash === here.hash) {
      e.preventDefault()
      arriveAt(decodeURIComponent(target.hash.slice(1)))
    }
  }
  return <Link to={to} onClick={handle} {...rest} />
}
