import { winAnsiByte, type StandardFont } from './helvetica'
import type { TrueTypeFont } from './sfnt'

/**
 * A small PDF writer: pages of text and lines, the two standard fonts, and TrueType fonts embedded whole. It writes
 * what Tynovo's specimen needs and nothing else, so the code that makes the file is short enough to read. Output is
 * deterministic: the same calls give the same bytes (on the same platform's deflate).
 */
const enc = new TextEncoder()

/** A number as PDF writes it: no exponent, at most two decimals. */
export const num = (n: number): string => {
  const s = n.toFixed(2)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

const hex = (n: number, digits: number) => n.toString(16).toUpperCase().padStart(digits, '0')

/** A text string: plain when it is printable ASCII, UTF-16BE with a byte-order mark otherwise. */
function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, '\\$&')})`
  let out = 'FEFF'
  for (let i = 0; i < s.length; i++) out += hex(s.charCodeAt(i), 4)
  return `<${out}>`
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

export type Rgb = [number, number, number]

/** A TrueType font that will be embedded in the file. */
export class EmbeddedFont {
  readonly kind = 'embedded' as const
  readonly used = new Map<number, number>() // glyph -> first code point drawn with it
  readonly name: string
  readonly bytes: Uint8Array
  readonly face: TrueTypeFont
  constructor(name: string, bytes: Uint8Array, face: TrueTypeFont) {
    this.name = name
    this.bytes = bytes
    this.face = face
  }
  has = (cp: number): boolean => this.face.glyphFor(cp) !== 0
  width = (text: string, size: number): number => ([...text].reduce((w, c) => w + this.face.advance(this.face.glyphFor(c.codePointAt(0)!)), 0) * size) / this.face.unitsPerEm
  /** Two bytes per glyph, as hex, noting which glyphs the file must describe. */
  encode(text: string): string {
    let out = ''
    for (const c of text) {
      const cp = c.codePointAt(0)!
      const g = this.face.glyphFor(cp)
      if (!this.used.has(g)) this.used.set(g, cp)
      out += hex(g, 4)
    }
    return out
  }
}

type AnyFont = StandardFont | EmbeddedFont

export class Page {
  readonly ops: string[] = []
  readonly fonts = new Set<AnyFont>()
  private readonly nameOf: (f: AnyFont) => string
  constructor(nameOf: (f: AnyFont) => string) {
    this.nameOf = nameOf
  }

  text(text: string, o: { x: number; y: number; size: number; font: AnyFont; color: Rgb; spacing?: number }): void {
    if (text === '') return
    this.fonts.add(o.font)
    const shown = o.font.kind === 'embedded' ? `<${o.font.encode(text)}>` : `<${[...text].map((c) => hex(winAnsiByte(c.codePointAt(0)!) ?? 0x3f, 2)).join('')}>`
    this.ops.push(`BT /${this.nameOf(o.font)} ${num(o.size)} Tf ${o.color.map(num).join(' ')} rg ${num(o.spacing ?? 0)} Tc ${num(o.x)} ${num(o.y)} Td ${shown} Tj ET`)
  }

  line(x0: number, y0: number, x1: number, y1: number, o: { width: number; color: Rgb }): void {
    this.ops.push(`${o.color.map(num).join(' ')} RG ${num(o.width)} w ${num(x0)} ${num(y0)} m ${num(x1)} ${num(y1)} l S`)
  }
}

export interface PdfInfo {
  title: string
  producer: string
  creator: string
  subject: string
  created: Date
}

export class PdfDocument {
  private readonly pages: Page[] = []
  private readonly fonts: AnyFont[] = []
  readonly size: [number, number]
  constructor(size: [number, number]) {
    this.size = size
  }

  private nameOf = (f: AnyFont): string => {
    let i = this.fonts.indexOf(f)
    if (i < 0) i = this.fonts.push(f) - 1
    return `F${i + 1}`
  }

  addPage(): Page {
    const p = new Page(this.nameOf)
    this.pages.push(p)
    return p
  }
  get pageCount(): number {
    return this.pages.length
  }

  async save(info: PdfInfo): Promise<Uint8Array> {
    const objects: Uint8Array[] = []
    const reserve = (): number => objects.push(new Uint8Array()) // ids are 1-based: the position after pushing
    const set = (id: number, body: string | Uint8Array) => {
      objects[id - 1] = typeof body === 'string' ? enc.encode(body) : body
    }
    const add = (body: string | Uint8Array): number => {
      const id = reserve()
      set(id, body)
      return id
    }
    const stream = async (dict: string, data: Uint8Array, extra = ''): Promise<number> => {
      const packed = await deflate(data)
      return add(concat([enc.encode(`<< ${dict} /Filter /FlateDecode ${extra}/Length ${packed.length} >>\nstream\n`), packed, enc.encode('\nendstream')]))
    }

    const catalog = reserve()
    const pagesId = reserve()
    const infoId = reserve()

    // Fonts. Every font any page used is declared once and listed on every page.
    const fontRefs = new Map<AnyFont, number>()
    for (const f of this.fonts) {
      if (f.kind === 'standard') {
        fontRefs.set(f, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f.name} /Encoding /WinAnsiEncoding >>`))
        continue
      }
      const t = f.face
      const k = 1000 / t.unitsPerEm
      const fileId = await stream(`/Length1 ${f.bytes.length}`, f.bytes)
      const descriptor = add(
        `<< /Type /FontDescriptor /FontName /${f.name} /Flags ${t.italicAngle ? 96 : 32} /FontBBox [${t.bbox.map((v) => num(v * k)).join(' ')}] /ItalicAngle ${num(t.italicAngle)} /Ascent ${num(t.ascent * k)} /Descent ${num(t.descent * k)} /CapHeight ${num(t.capHeight * k)} /StemV 80 /FontFile2 ${fileId} 0 R >>`,
      )
      const glyphs = [...f.used.keys()].sort((a, b) => a - b)
      const widths = glyphs.map((g) => `${g} [${num(t.advance(g) * k)}]`).join(' ')
      const cid = add(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW 0 /W [${widths}] >>`,
      )
      // ToUnicode lets a viewer copy and search the text: it maps each glyph back to the character drawn with it.
      const pairs = glyphs.map((g) => {
        const cp = f.used.get(g)!
        const u = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp]
        return `<${hex(g, 4)}> <${u.map((x) => hex(x, 4)).join('')}>`
      })
      const blocks: string[] = []
      for (let i = 0; i < pairs.length; i += 100) blocks.push(`${Math.min(100, pairs.length - i)} beginbfchar\n${pairs.slice(i, i + 100).join('\n')}\nendbfchar`)
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`
      const toUnicode = await stream('', enc.encode(cmap))
      fontRefs.set(f, add(`<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`))
    }
    const fontDict = `<< ${this.fonts.map((f, i) => `/F${i + 1} ${fontRefs.get(f)} 0 R`).join(' ')} >>`

    const pageIds: number[] = []
    for (const p of this.pages) {
      const content = await stream('', enc.encode(p.ops.join('\n')))
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.size[0])} ${num(this.size[1])}] /Resources << /Font ${fontDict} >> /Contents ${content} 0 R >>`))
    }
    set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
    set(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
    const d = info.created
    const stamp = `D:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`
    set(infoId, `<< /Title ${pdfString(info.title)} /Producer ${pdfString(info.producer)} /Creator ${pdfString(info.creator)} /Subject ${pdfString(info.subject)} /CreationDate (${stamp}) /ModDate (${stamp}) >>`)

    // Body, then the cross-reference table that says where each object starts.
    const parts: Uint8Array[] = [Uint8Array.of(...enc.encode('%PDF-1.7\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a)]
    let at = parts[0]!.length
    const offsets: number[] = []
    objects.forEach((body, i) => {
      const head = enc.encode(`${i + 1} 0 obj\n`)
      const tail = enc.encode('\nendobj\n')
      offsets.push(at)
      parts.push(head, body, tail)
      at += head.length + body.length + tail.length
    })
    const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `)].join('\n')
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', concat(parts) as BufferSource))
    const id = [...digest.subarray(0, 16)].map((b) => hex(b, 2)).join('')
    parts.push(enc.encode(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${infoId} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${at}\n%%EOF\n`))
    return concat(parts)
  }
}
