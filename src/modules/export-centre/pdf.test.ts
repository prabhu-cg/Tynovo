// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { createSampleProject } from '@/modules/brand-system/sample'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { contentRevision } from '@/modules/brand-system/revision'
import { updateRole } from '@/modules/brand-system/ops'
import { buildBundle } from './bundle'
import { buildSpecimenPdf, type CatalogFileLoader } from './pdf'
import { parseTrueType } from './pdf-kit/sfnt'
import { woffToSfnt } from './pdf-kit/woff'
import type { ExportInput } from './types'

/** Reads the same bundled WOFF files the browser fetches. */
const fromDisk: CatalogFileLoader = async (id, weight) => new Uint8Array(readFileSync(`node_modules/@fontsource/${id}/files/${id}-latin-${weight}-normal.woff`))
const noFiles: CatalogFileLoader = async () => {
  throw new Error('offline')
}
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')

/** Every stream in the file, inflated, as text. Page content and ToUnicode maps are among them. */
function streams(bytes: Uint8Array): string[] {
  const text = latin1(bytes)
  const out: string[] = []
  for (const m of text.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
    const start = m.index! + m[0].length
    const raw = Buffer.from(bytes.subarray(start, start + Number(m[1])))
    try {
      out.push(inflateSync(raw).toString('latin1'))
    } catch {
      out.push('')
    }
  }
  return out
}
/** The text drawn in the standard (Helvetica) fonts, in order; embedded fonts draw glyph ids, which are not readable here. */
function helveticaText(bytes: Uint8Array): string {
  const file = latin1(bytes)
  const standardIds = new Set([...file.matchAll(/(\d+) 0 obj\n<< \/Type \/Font \/Subtype \/Type1 /g)].map((m) => m[1]))
  const names = new Set<string>()
  for (const m of file.matchAll(/\/(F\d+) (\d+) 0 R/g)) if (standardIds.has(m[2]!)) names.add(m[1]!)
  const out: string[] = []
  for (const content of streams(bytes)) {
    for (const m of content.matchAll(/BT \/(F\d+) [\d.]+ Tf[^\n]*? <([0-9A-F]+)> Tj ET/g)) if (names.has(m[1]!)) out.push(Buffer.from(m[2]!, 'hex').toString('latin1'))
  }
  return out.join(' ')
}
const pages = (bytes: Uint8Array) => (latin1(bytes).match(/\/Type \/Page /g) ?? []).length

/** The cross-reference table must point at the start of every object, or a viewer has to repair the file. */
function expectValidStructure(bytes: Uint8Array) {
  const text = latin1(bytes)
  expect(text.startsWith('%PDF-1.7\n')).toBe(true)
  expect(text.endsWith('%%EOF\n')).toBe(true)
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)![1])
  expect(text.slice(startxref, startxref + 4)).toBe('xref')
  const [, header, ...rest] = text.slice(startxref).split('\n')
  const count = Number(header!.split(' ')[1])
  const entries = rest.slice(0, count)
  expect(entries[0]).toBe('0000000000 65535 f ')
  entries.slice(1).forEach((e, i) => {
    expect(e).toMatch(/^\d{10} 00000 n $/)
    const at = Number(e.slice(0, 10))
    expect(text.slice(at, at + `${i + 1} 0 obj\n`.length)).toBe(`${i + 1} 0 obj\n`)
  })
  expect(text).toContain(`/Size ${count}`)
}

const inputOf = async (project = createSampleProject(), font: ExportInput['font'] = null): Promise<ExportInput> => ({
  project, revision: await contentRevision(project), generatedAt: '2026-05-01T10:00:00.000Z', font, fontBlocked: false,
})

describe('PDF kit', () => {
  it('turns a bundled WOFF into a TrueType font and reads the glyphs and widths a PDF needs', async () => {
    const sfnt = await woffToSfnt(await fromDisk('manrope', 400))
    expect(Buffer.from(sfnt.subarray(0, 4)).readUInt32BE(0)).toBe(0x00010000)
    const font = parseTrueType(sfnt)
    expect(font.unitsPerEm).toBe(2000)
    expect(font.glyphFor('A'.codePointAt(0)!)).toBeGreaterThan(0)
    expect(font.glyphFor(0x4e2d)).toBe(0) // no CJK in a Latin file
    const a = font.glyphFor(97)
    const i = font.glyphFor(105)
    expect(font.advance(a)).toBeGreaterThan(font.advance(i)) // an "a" is wider than an "i"
  })

  it('reads every bundled catalog font, every weight, without error', async () => {
    const { CATALOG } = await import('@/modules/font-catalog/catalog')
    for (const c of CATALOG) for (const w of c.weights) {
      const font = parseTrueType(await woffToSfnt(await fromDisk(c.id, w)))
      expect(font.glyphFor(72), `${c.id} ${w}`).toBeGreaterThan(0)
    }
  }, 60_000)

  it('refuses something that is not a TrueType font', async () => {
    expect(() => parseTrueType(new Uint8Array(64))).toThrow()
    await expect(woffToSfnt(new Uint8Array(64))).rejects.toThrow()
  })
})

describe('PDF specimen', () => {
  it('is a well-formed PDF: every cross-reference points at its object', async () => {
    expectValidStructure(await buildSpecimenPdf(await inputOf(), fromDisk))
  })

  it('has several pages, the brand as its title and the revision in its metadata', async () => {
    const input = await inputOf()
    const text = latin1(await buildSpecimenPdf(input, fromDisk))
    expect(pages(Buffer.from(text, 'latin1'))).toBeGreaterThanOrEqual(3)
    expect(text).toContain('/Title (Fieldnote - typography specimen)')
    expect(text).toContain('/Producer (Tynovo)')
    expect(text).toContain(`/Creator (Tynovo, project revision ${input.revision})`)
    expect(text).toContain('/CreationDate (D:20260501100000Z)')
  })

  it('is the same bytes for the same project (the file hash can be compared with a later export)', async () => {
    const input = await inputOf()
    const a = await buildSpecimenPdf(input, fromDisk)
    const b = await buildSpecimenPdf(input, fromDisk)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('embeds the bundled fonts the roles use, with a ToUnicode map so the text can be copied', async () => {
    const bytes = await buildSpecimenPdf(await inputOf(), fromDisk)
    const text = latin1(bytes)
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+Fraunces/)
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+SourceSans3/)
    expect(text).toContain('/FontFile2')
    expect(text).toContain('/ToUnicode')
    const maps = streams(bytes).filter((s) => s.includes('beginbfchar'))
    expect(maps.length).toBeGreaterThanOrEqual(3)
    // "Hamburgefonstiv" is drawn in the type scale, so each of its letters is mapped back to its Unicode value.
    expect(maps.some((m) => /<0048>|<00[0-9A-F]{2}> <0048>/.test(m))).toBe(true)
    expect(helveticaText(bytes)).toContain('SIL Open Font License permits for documents')
  })

  it('draws a font it cannot embed in Helvetica and says why beside the sample', async () => {
    const bytes = await buildSpecimenPdf(await inputOf(), noFiles)
    expect(latin1(bytes)).not.toMatch(/\+Fraunces/)
    expect(helveticaText(bytes)).toContain('could not be loaded here, so Helvetica is shown')
    expectValidStructure(bytes)
  })

  it('names an installed-only font as not embedded', async () => {
    const bytes = await buildSpecimenPdf(await inputOf(integratedProject()), fromDisk)
    expect(helveticaText(bytes)).toContain('Helvetica Neue is not bundled with Tynovo, so it cannot be embedded')
    expect(helveticaText(bytes)).toContain('renders only where installed')
  })

  it('survives text no font can draw (emoji, CJK) by drawing a question mark, not failing', async () => {
    let p = createSampleProject()
    p = { ...p, brand: { ...p.brand, name: 'Café ☕ 東京', sampleCopy: { ...p.brand.sampleCopy, headline: 'Ünïcode ☃ 😀', body: 'Zażółć gęślą jaźń — “quotes” and 日本語.\nSecond line.' } } }
    const bytes = await buildSpecimenPdf(await inputOf(p), fromDisk)
    expectValidStructure(bytes)
    expect(helveticaText(bytes)).toContain('Caf')
  })

  it('applies letter spacing and a non-default weight, and notes a weight the font lacks', async () => {
    let p = createSampleProject()
    const body = p.typography.roles.find((r) => r.kind === 'body')!
    p = updateRole(p, body.id, { weight: 100, letterSpacingEm: 0.12 })
    const bytes = await buildSpecimenPdf(await inputOf(p), fromDisk)
    expect(helveticaText(bytes)).toContain('Source Sans 3 has no 100 weight')
    expect(streams(bytes).some((s) => /[1-9][\d.]* Tc /.test(s))).toBe(true)
  })

  it('is part of the bundle, listed in the manifest and in the zip, and recorded as its own kind', async () => {
    const bundle = await buildBundle(createSampleProject(), fakeClock(), { loadCatalogFile: fromDisk })
    const pdf = bundle.files.pdf
    expect(pdf).toMatchObject({ path: 'specimen.pdf', mimeType: 'application/pdf', kind: 'specimen-pdf', available: true })
    expect(pdf.bytes.length).toBeGreaterThan(20_000)
    expect(bundle.order).toContain('pdf')
    expect(latin1(bundle.files.manifest.bytes)).toContain('specimen.pdf')
    expect(latin1(bundle.files.package.bytes)).toContain('specimen.pdf')
  })

  it('writes the PDF for manual inspection when WRITE_PDF is set', async () => {
    if (!process.env['WRITE_PDF']) return
    const bundle = await buildBundle(createSampleProject(), fakeClock(), { loadCatalogFile: fromDisk })
    writeFileSync(process.env['WRITE_PDF'], bundle.files.pdf.bytes)
  })
})
