// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MARK_COLORS, MARK_PATHS, MARK_VIEWBOX, PRODUCT_NAME, TAGLINE } from './identity'

/** The logo as supplied, kept verbatim in public/tynovo-logo.svg. Everything drawn in the product comes from it. */
const supplied = readFileSync('public/tynovo-logo.svg', 'utf8')

describe('identity', () => {
  it('names the product and its tagline', () => {
    expect(PRODUCT_NAME).toBe('Tynovo')
    expect(TAGLINE).toBe('Shape your brand’s voice')
  })

  it('draws the supplied mark exactly: same outlines, same order, same colours, same size', () => {
    const shapes = [...supplied.matchAll(/<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => ({ d: m[1], fill: m[2] }))
    expect(shapes.length).toBe(MARK_PATHS.length)
    shapes.forEach((s, i) => {
      expect(MARK_PATHS[i]!.d).toBe(s.d)
      expect(MARK_COLORS[MARK_PATHS[i]!.fill].toLowerCase()).toBe((s.fill ?? '').toLowerCase())
    })
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(supplied)!
    expect([Number(box[1]), Number(box[2])]).toEqual([MARK_VIEWBOX.width, MARK_VIEWBOX.height])
  })

  it('keeps the logo in the colours it was drawn in, and the interface on the Doxa-matched tokens', () => {
    // The mark is the user's artwork and keeps its own greys; the interface tokens follow Doxa (warm ink).
    expect(MARK_COLORS).toEqual({ ink: '#444444', accent: '#C74504' })
    const tokens = readFileSync('src/modules/design-tokens/tokens.css', 'utf8')
    expect(tokens.toLowerCase()).toContain('--color-accent: #c74504')
    expect(tokens.toLowerCase()).toContain('--color-ink: #1c1917')
    expect(tokens.toLowerCase()).toContain('--color-sheet: #f4f2ea')
  })
})
