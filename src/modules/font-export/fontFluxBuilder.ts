import { analyzeTypeface } from '../font-validation/coverage'
import { deriveMetrics } from '../typeface-engine/dna'
import { loadFontFlux } from './loadFontFlux'
import { patchOs2 } from './sfntPatch'
import type { FontBuilder, FontBuildInput, FontBuildResult } from './types'

const psName = (family: string, style: string) => `${family}-${style}`.replace(/[^A-Za-z0-9-]/g, '')

/**
 * Real TrueType export through Font Flux JS (GPL-3.0-only, bundled in this GPL-3.0 app).
 * The licence of the produced font is the project owner's choice and is unrelated to the library's.
 */
export const fontFluxBuilder: FontBuilder = {
  id: 'font-flux-js',
  async build({ typeface, timestamp, version }: FontBuildInput): Promise<FontBuildResult> {
    const { FontFlux } = await loadFontFlux()
    const m = deriveMetrics(typeface.dna)
    const font = FontFlux.create({
      family: typeface.familyName,
      unitsPerEm: m.unitsPerEm,
      ascender: m.ascender,
      descender: m.descender,
    })

    font.setInfo({
      styleName: typeface.styleName,
      fullName: `${typeface.familyName} ${typeface.styleName}`,
      postScriptName: psName(typeface.familyName, typeface.styleName),
      lineGap: m.lineGap,
      version,
      created: timestamp,
      modified: timestamp,
      ...(typeface.copyright ? { copyright: typeface.copyright } : {}),
      ...(typeface.license.name ? { license: typeface.license.name } : {}),
      ...(typeface.license.url ? { licenseURL: typeface.license.url } : {}),
    })

    const byChar = new Map<string, string>()
    // Only glyphs that passed validation go into the font; the rest are reported, never silently shipped.
    for (const g of analyzeTypeface(typeface).supported) {
      byChar.set(g.char, g.name)
      font.addGlyph({
        name: g.name,
        unicode: g.char.codePointAt(0)!,
        advanceWidth: g.advanceWidth,
        contours: g.contours.map((c) => c.map((p) => ({ x: p.x, y: p.y, onCurve: p.onCurve }))),
      })
    }

    for (const k of typeface.kerning) {
      const left = byChar.get(k.left)
      const right = byChar.get(k.right)
      if (left && right) font.addKerning({ left, right, value: k.value })
    }

    // Font Flux derives OS/2 win metrics from glyph bounds; set them to the declared metrics instead.
    const bytes = patchOs2(new Uint8Array(font.export()), {
      winAscent: m.ascender,
      winDescent: Math.abs(m.descender),
      xHeight: m.xHeight,
      vendorId: 'NONE',
    })
    const filename = `${psName(typeface.familyName, typeface.styleName)}.ttf`
    return { bytes, filename, mimeType: 'font/ttf', format: 'truetype' }
  },
}
