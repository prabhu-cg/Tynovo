// @vitest-environment node
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { layoutRun, layoutText } from './layout'

const face = () => ({ ...createTypeface('f', 'geometric'), kerning: [{ left: 'A', right: 'V', value: -80 }] })
const adv = (c: string) => analyzeTypeface(face()).reports.get(c)!.glyph!.advanceWidth

describe('layoutText', () => {
  it('places glyphs by advance width and applies kerning', () => {
    const { lines } = layoutText(face(), 'AVA')
    expect(lines[0]!.items.map((i) => i.x)).toEqual([0, adv('A') - 80, adv('A') - 80 + adv('V')])
  })
  it('adds tracking after every character and word spacing to spaces', () => {
    const { lines, width } = layoutText(face(), 'H H', { tracking: 10, wordSpacing: 30 })
    const xs = lines[0]!.items.map((i) => i.x)
    expect(xs[1]).toBe(adv('H') + 10)
    expect(xs[2]).toBe(adv('H') + 10 + adv(' ') + 10 + 30)
    expect(width).toBe(xs[2]! + adv('H') + 10)
  })
  it('reports characters the typeface does not have and skips them', () => {
    const r = layoutText(face(), 'HéH')
    expect(r.missing).toEqual(['é'])
    expect(r.lines[0]!.items.map((i) => i.char)).toEqual(['H', 'H'])
  })
  it('breaks lines at spaces when a word would pass the maximum width, and on newlines', () => {
    const w = adv('H') * 2 + adv(' ')
    const r = layoutText(face(), 'HH HH HH', { maxWidth: w + 1 })
    expect(r.lines.map((l) => l.items.filter((i) => i.char !== ' ').length)).toEqual([2, 2, 2])
    expect(r.lines.every((l) => l.items[0]!.x === 0)).toBe(true)
    expect(layoutText(face(), 'H\nH').lines).toHaveLength(2)
  })
  it('never breaks inside a word, even one wider than the line', () => {
    const r = layoutText(face(), 'HHHHHH', { maxWidth: 100 })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]!.items).toHaveLength(6)
  })
  it('keeps layoutRun as the single-line view of the same engine', () => {
    expect(layoutRun(face(), 'AV').width).toBe(layoutText(face(), 'AV').width)
  })
})
