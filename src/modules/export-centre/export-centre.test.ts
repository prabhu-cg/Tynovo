// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fontkit from 'fontkit'
import { addNamedFont, assignCustomTypeface, assignSource, removeCustomTypeface, updateRole } from '@/modules/brand-system/ops'
import { contentRevision } from '@/modules/brand-system/revision'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { createProject } from '@/modules/brand-projects/model'
import { buildBundle } from './bundle'
import { buildCss } from './css'
import { buildManifest } from './manifest'
import { buildSpec } from './spec'
import { buildSpecimen } from './specimen'
import { stackList } from './stack'
import { buildTokens } from './tokens'
import type { ExportInput } from './types'
import { createZip, crc32 } from './zip'

const input = async (p = integratedProject(), font: ExportInput['font'] = null): Promise<ExportInput> => ({
  project: p, revision: await contentRevision(p), generatedAt: '2026-05-01T10:00:00.000Z', font, fontBlocked: false,
})
const FAKE_FONT = { filename: 'NorthwindSans-Regular.ttf', bytes: new Uint8Array([0, 1, 0, 0, 9, 9]), mimeType: 'font/ttf', format: 'ttf' as const, sha256: 'a'.repeat(64) }

/** What is left of a stylesheet once its strings and comments are removed, tokenised the way a browser does. */
function outsideStringsAndComments(css: string): string {
  let out = ''
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end < 0) return out + '<unterminated comment>'
      i = end + 1
    } else if (c === '"' || c === "'") {
      i++
      while (i < css.length && css[i] !== c) i += css[i] === '\\' ? 2 : 1
      if (css[i] !== c) return out + '<unterminated string>'
    } else out += c
  }
  return out
}

describe('CSS', () => {
  it('declares the custom font once, names existing fonts without bundling them, and carries every role', async () => {
    const css = buildCss(await input(undefined, FAKE_FONT))
    expect(css.match(/^@font-face \{/gm)).toHaveLength(1)
    expect(css).toContain('font-family: "Northwind Sans";')
    expect(css).toContain('src: url("fonts/NorthwindSans-Regular.ttf") format("truetype");')
    expect(css).toContain('--font-body: "Manrope", sans-serif;')
    expect(css).toContain('--font-ui: "Helvetica Neue", sans-serif;')
    expect(css).toContain('--font-display: "Northwind Sans", sans-serif;')
    expect(css).toMatch(/--type-display-size: 3\.815rem;/)
    expect(css).toContain('.type-heading {')
    expect(css).not.toMatch(/url\([^)]*manrope/i)
  })

  it('says which fonts are not included and where the bundled ones come from', async () => {
    const css = buildCss(await input(undefined, FAKE_FONT))
    expect(css).toMatch(/NOT included/)
    expect(css).toContain('@fontsource/manrope')
    expect(css).toMatch(/Helvetica Neue.*named by you; it renders only where it is installed/)
    expect(css).toMatch(/Licence: Not recorded \(not verified\)/)
  })

  it('declares no @font-face when the font file is unavailable, and says why', async () => {
    const css = buildCss({ ...(await input()), fontBlocked: true })
    expect(css).not.toMatch(/^@font-face \{/m)
    expect(css).toMatch(/could not be built/)
  })

  it('leaves unassigned roles on the inherited font instead of inventing one', async () => {
    const css = buildCss(await input(createProject('Plain', fakeClock())))
    expect(css).toMatch(/\.type-display \{\n {2}font-family: inherit;/)
    expect(css).not.toMatch(/--font-display/)
  })

  it('cannot be broken out of by hostile names', async () => {
    let p = integratedProject('x */ body{display:none} /*')
    p = { ...p, customTypeface: { ...p.customTypeface!, familyName: 'Evil"; } body{color:red} /*' } }
    const css = buildCss(await input(p, FAKE_FONT))
    expect(css).not.toMatch(/\*\/ body/)
    expect(css).toContain('font-family: "Evil\\"; } body{color:red} /*";')
    // Walk the file like a CSS tokenizer: whatever the hostile text said, it must stay inside a string or a comment.
    expect(outsideStringsAndComments(css)).not.toMatch(/color:\s*red|display:\s*none/)
  })

  it('reads its own stacks back', () => {
    expect(stackList('"A \\"b\\"", "C", sans-serif')).toEqual(['A "b"', 'C', 'sans-serif'])
  })
})

describe('tokens', () => {
  it('writes DTCG tokens with the same role values as the CSS', async () => {
    const i = await input(undefined, FAKE_FONT)
    const t = JSON.parse(buildTokens(i))
    expect(t.typography.display.$value).toEqual({ fontFamily: ['Northwind Sans', 'sans-serif'], fontSize: '61.04px', fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.02em' })
    expect(t.typography.body.$value.fontFamily).toEqual(['Manrope', 'sans-serif'])
    expect(t.scale['step-0']).toEqual({ $type: 'dimension', $value: '16px' })
    expect(t.typography.display.$extensions['com.tynovo']).toMatchObject({ origin: 'custom', includedInExport: true, kind: 'display' })
    expect(t.typography.body.$extensions['com.tynovo']).toMatchObject({ origin: 'catalog', includedInExport: false })
    expect(t.typography.ui.$extensions['com.tynovo'].licence).toMatchObject({ verified: false })
    expect(t.$extensions['com.tynovo'].revision).toBe(i.revision)
  })
})

describe('specification', () => {
  it('describes roles, fonts, licences and limits, marking custom and existing differently', async () => {
    const md = buildSpec(await input(undefined, FAKE_FONT))
    expect(md).toMatch(/^# Northwind: typography specification/)
    expect(md).toContain('| Display | Display | Northwind Sans | Custom typeface | 61.04px | 400 |')
    expect(md).toContain('| Body | Body text | Manrope | Existing font, bundled |')
    expect(md).toContain('### Northwind Sans (Custom typeface)')
    expect(md).toContain('### Manrope (Existing font, bundled)')
    expect(md).toMatch(/Manrope[\s\S]*not included/)
    expect(md).toMatch(/One style, Regular/)
    expect(md).toContain('> Line one\n> Line two')
    expect(md).toMatch(/## Checks at export time/)
  })

  it('escapes user text', async () => {
    const p = integratedProject('Acme | <b>*bold*</b>')
    const md = buildSpec(await input(p))
    expect(md.split('\n')[0]).toBe('# Acme \\| \\<b\\>\\*bold\\*\\</b\\>: typography specification')
  })

  it('reports fit findings for each role set in the custom typeface', async () => {
    const p = integratedProject()
    const md = buildSpec(await input(updateRole(p, p.typography.roles[1]!.id, { weight: 700 })))
    expect(md).toMatch(/\*\*Heading\*\*: use with care\./)
    expect(md).toMatch(/Warning: The role asks for weight 700/)
  })
})

describe('specimen', () => {
  it('is one self-contained page that embeds the custom font and no script', async () => {
    const html = buildSpecimen(await input(undefined, FAKE_FONT))
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('src: url("data:font/ttf;base64,AAEAAAkJ")')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/(src|href)=["']?https?:|url\(["']?https?:/) // nothing is fetched
    expect(html).toContain('class="type-display sample"')
    expect(html).toMatch(/not included/)
  })

  it('escapes the project name everywhere', async () => {
    const html = buildSpecimen(await input(integratedProject('</title><script>alert(1)</script>'), FAKE_FONT))
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;')
  })
})

describe('hostile text in every user-written field', () => {
  const HTML = '</title></style><script>window.x=1</script><img src=x onerror=alert(1)>'
  const CSS = '"; } body{color:red} /* \\'

  /** Every field a person can type into that an export prints. */
  async function hostile() {
    let p = integratedProject(HTML)
    const [display, , body] = p.typography.roles
    p = { ...p, brand: { ...p.brand, name: HTML, description: HTML, personality: [HTML, CSS], notes: HTML, sampleCopy: { headline: HTML, subhead: HTML, body: HTML, caption: HTML } } }
    p = { ...p, customTypeface: { ...p.customTypeface!, familyName: CSS, styleName: HTML } }
    p = updateRole(p, display!.id, { name: HTML })
    const named = addNamedFont(p, CSS, 'sans-serif')!
    p = assignSource(named.project, body!.id, named.sourceId)
    return input(p, FAKE_FONT)
  }

  it('cannot add markup to the specimen', async () => {
    const html = buildSpecimen(await hostile())
    expect(html.match(/<script/gi)).toBeNull()
    expect(html.match(/<img/gi)).toBeNull()
    expect(html.match(/<\/style>/gi)).toHaveLength(1) // only the one that closes the real stylesheet
    expect(html.match(/<\/title>/gi)).toHaveLength(1)
    expect(html).not.toMatch(/<[^>]*\son\w+\s*=/i) // no tag carries an event handler (the escaped text may still say "onerror=")
  })

  it('cannot add rules to the stylesheet or break out of the specimen stylesheet', async () => {
    const css = buildCss(await hostile())
    expect(outsideStringsAndComments(css)).not.toMatch(/color:\s*red|window\.x|<\/style/i)
    const html = buildSpecimen(await hostile())
    const sheet = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'))
    expect(sheet).not.toContain('<')
    expect(outsideStringsAndComments(sheet)).not.toMatch(/color:\s*red/)
  })

  it('keeps the tokens, specification and manifest well formed', async () => {
    const i = await hostile()
    expect(() => JSON.parse(buildTokens(i))).not.toThrow()
    const roles = Object.values(JSON.parse(buildTokens(i)).typography) as { $value: unknown }[]
    expect(roles.length).toBeGreaterThanOrEqual(5)
    for (const r of roles) expect(r.$value).toBeTypeOf('object')
    // Markdown cannot run anything, but raw HTML in it is printed as written; the files are documentation, not pages.
    expect(buildSpec(i).length).toBeGreaterThan(0)
    expect(buildManifest(i, []).length).toBeGreaterThan(0)
  })
})

describe('manifest', () => {
  it('records source, licence, confirmation and whether the file is included, for every font', async () => {
    const i = await input(undefined, FAKE_FONT)
    const md = buildManifest(i, [{ path: 'typography.css', bytes: 10, sha256: 'b'.repeat(64) }])
    expect(md).toMatch(/\| Northwind Sans \| Display, Heading \| Custom typeface \| none chosen[^|]*\| no \| `fonts\/NorthwindSans-Regular.ttf` \|/)
    expect(md).toMatch(/\| Manrope \| Body, Caption \| Existing font, bundled \| SIL Open Font License 1.1 \(OFL-1.1\) \| yes \| no: supply separately \|/)
    expect(md).toMatch(/\| Helvetica Neue \| UI \| Existing font, by name \| Not recorded \| no \|/)
    expect(md).toMatch(/No font file made by someone else is included in this export, with one exception: the PDF specimen embeds/)
    expect(md).toMatch(/GPL-3.0-only\) is separate from the licence of a font you design/)
    expect(md).toContain('`typography.css` | 10 |')
    expect(md).toMatch(/not legal advice/)
  })
})

describe('zip', () => {
  it('writes an archive that a real unzip tool accepts, with the right bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'))
    const entries = [{ path: 'a.txt', bytes: new TextEncoder().encode('hello') }, { path: 'fonts/Ünï.ttf', bytes: new Uint8Array([0, 1, 2, 3, 255]) }, { path: 'empty', bytes: new Uint8Array() }]
    const file = join(dir, 'x.zip')
    writeFileSync(file, createZip(entries, new Date('2026-05-01T10:00:00Z')))
    const py = `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(sorted(z.namelist()), z.read('a.txt'), list(z.read('fonts/Ünï.ttf')))`
    const out = execFileSync('python3', ['-I', '-c', py, file], { encoding: 'utf8' })
    expect(out).toContain("['a.txt', 'empty', 'fonts/Ünï.ttf']")
    expect(out).toContain("b'hello'")
    expect(out).toContain('[0, 1, 2, 3, 255]')
  })
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })
  it('refuses paths that could escape the folder, and duplicates', () => {
    const b = new Uint8Array()
    for (const path of ['../x', '/x', 'a\\b']) expect(() => createZip([{ path, bytes: b }], new Date())).toThrow(/Unsafe/)
    expect(() => createZip([{ path: 'a', bytes: b }, { path: 'a', bytes: b }], new Date())).toThrow(/Duplicate/)
  })
})

describe('bundle: every export describes the same saved project', () => {
  it('builds a checked font once and refers to those exact bytes everywhere', async () => {
    const p = integratedProject()
    const b = await buildBundle(p, fakeClock())
    expect(b.revision).toBe(await contentRevision(p))
    expect(b.fontResult?.ok).toBe(true)
    const font = b.files.font
    expect(font.available).toBe(true)
    // the file is a real font with the typeface's name, and the specimen embeds the same bytes
    const parsed = fontkit.create(Buffer.from(font.bytes)) as fontkit.Font
    expect(parsed.familyName).toBe('Northwind Sans')
    const html = new TextDecoder().decode(b.files.specimen.bytes)
    expect(html).toContain(Buffer.from(font.bytes).toString('base64'))
    // the manifest lists the font's real hash, and the zip holds the same font and CSS
    const manifest = new TextDecoder().decode(b.files.manifest.bytes)
    expect(manifest).toContain(font.sha256)
    expect(manifest).toContain(b.files.css.sha256)
    for (const f of [b.files.spec, b.files.tokens, b.files.css, b.files.specimen, b.files.project]) expect(new TextDecoder().decode(f.bytes)).toContain(b.revision.length === 12 ? (f.id === 'project' ? p.id : b.revision) : '')
    const dir = mkdtempSync(join(tmpdir(), 'bundle-'))
    const zipPath = join(dir, 'p.zip')
    writeFileSync(zipPath, b.files.package.bytes)
    const names = execFileSync('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(sorted(z.namelist())))', zipPath], { encoding: 'utf8' }).trim().split('\n')
    expect(names).toEqual(['SOURCES-AND-LICENSES.md', 'fonts/NorthwindSans-Regular.ttf', 'northwind.tynovo.json', 'specimen.html', 'specimen.pdf', 'tokens.json', 'typography-spec.md', 'typography.css'])
  }, 30_000)

  it('builds the same font bytes every time for the same design', async () => {
    const p = integratedProject()
    const a = await buildBundle(p, fakeClock())
    const b = await buildBundle(p, fakeClock('2027-01-01T00:00:00.000Z'))
    expect(a.files.font.sha256).toBe(b.files.font.sha256)
  }, 30_000)

  it('changes its revision, CSS, tokens and spec when a role changes, and the font when the design changes', async () => {
    const p = integratedProject()
    const a = await buildBundle(p, fakeClock())
    const p2 = updateRole(p, p.typography.roles[2]!.id, { lineHeight: 1.8 })
    const b = await buildBundle(p2, fakeClock())
    expect(b.revision).not.toBe(a.revision)
    for (const id of ['css', 'tokens', 'spec'] as const) expect(b.files[id].sha256, id).not.toBe(a.files[id].sha256)
    expect(b.files.font.sha256).toBe(a.files.font.sha256)
    const p3 = { ...p, customTypeface: { ...p.customTypeface!, dna: { ...p.customTypeface!.dna, strokeThickness: 140 } } }
    const c = await buildBundle(p3, fakeClock())
    expect(c.files.font.sha256).not.toBe(a.files.font.sha256)
  }, 30_000)

  it('works without a custom typeface: no font file, no @font-face, package still complete', async () => {
    const p = removeCustomTypeface(integratedProject())
    const b = await buildBundle(p, fakeClock())
    expect(b.files.font.available).toBe(false)
    expect(b.files.font.unavailableReason).toMatch(/no custom typeface/)
    expect(new TextDecoder().decode(b.files.css.bytes)).not.toMatch(/^@font-face \{/m)
    expect(b.files.package.available).toBe(true)
  }, 30_000)

  it('withholds the files that depend on a font file that cannot be built', async () => {
    const p = integratedProject()
    const bad = { ...p, customTypeface: { ...p.customTypeface!, overrides: { H: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 1, y: 0, onCurve: true }, { x: 2, y: 0, onCurve: true }]] } } } }
    const b = await buildBundle(bad, fakeClock())
    expect(b.fontResult?.ok).toBe(false)
    for (const id of ['css', 'specimen', 'package'] as const) {
      expect(b.files[id].available, id).toBe(false)
      expect(b.files[id].unavailableReason).toMatch(/errors/)
    }
    for (const id of ['spec', 'tokens', 'manifest', 'project'] as const) expect(b.files[id].available, id).toBe(true)
  }, 30_000)

  it('does not need the typeface when it is unused, even if broken', async () => {
    const p = assignCustomTypeface(createProject('x', fakeClock()), 'nope')
    expect((await buildBundle(p, fakeClock())).files.package.available).toBe(true)
  }, 30_000)
})
