/**
 * Going to a place on a page: scroll it into view, move focus to its heading so a keyboard or screen-reader user lands
 * there too, and wash the section in the accent for a moment so the eye finds it. A link that points at the page you are
 * already on used to do nothing visible ("it does not work"); this makes every such jump answer.
 * Reduced motion: no smooth scroll, and the wash is a short fade (see index.css), never a movement.
 */
const WASH_MS = 1700
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()

export function arriveAt(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  const heading = el.querySelector<HTMLElement>('h1, h2, h3')
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }
  // Restart the wash if the same section is asked for again.
  clearTimeout(timers.get(el))
  const clear = () => {
    el.removeAttribute('data-arrive')
    el.removeAttribute('data-fade')
  }
  clear()
  void el.offsetWidth
  // data-fade exempts the wash from the reduced-motion rule that stops animations: a colour that fades is not movement.
  el.setAttribute('data-arrive', '')
  el.setAttribute('data-fade', '')
  timers.set(el, setTimeout(clear, WASH_MS))
  return true
}
