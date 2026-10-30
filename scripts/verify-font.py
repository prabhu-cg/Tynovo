#!/usr/bin/env python3
"""Developer tool: checks an exported font with fontTools, independently of the app and of the library that wrote it.

  python3 -m venv .venv && .venv/bin/pip install fonttools brotli
  .venv/bin/python scripts/verify-font.py spikes/output/FormatTest-Regular.ttf [--coretext]

Checks (exit code 1 if any fails):
  - opens with strict table and whole-file checksum verification
  - every glyph's hmtx left side bearing equals where its ink starts: the glyph header's xMin for TrueType (the box around
    every point, control points included, which is what FreeType positions by) and the curve's own xMin for CFF
    (including .notdef)
  - cmap maps only to glyphs that exist, no duplicate glyph names, .notdef is glyph 0
  - the outline direction follows the format (TrueType: outer contours clockwise; CFF: counter-clockwise)
  - names, head.fontRevision against the version string, OS/2 fsSelection against the style
  - with --coretext: compares advance widths and mappings that CoreText reports with the file's own tables
"""
import re, subprocess, sys
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

path = sys.argv[1]
failures: list[str] = []
def check(ok: bool, message: str) -> None:
    print(("ok    " if ok else "FAIL  ") + message)
    if not ok: failures.append(message)

font = TTFont(path, checkChecksums=2)  # raises on any bad table checksum
cff = 'CFF ' in font
check(True, f"opens with strict checksums ({'CFF' if cff else 'glyf'} outlines, {len(font.getGlyphOrder())} glyphs)")
glyphs = font.getGlyphSet()
order = font.getGlyphOrder()
check(order[0] == '.notdef', '.notdef is glyph 0')
check(len(set(order)) == len(order), 'glyph names are unique')
cmap = font.getBestCmap()
check(all(g in order for g in cmap.values()), f'all {len(cmap)} cmap entries point at existing glyphs')

hmtx = font['hmtx']
bad = []
for name in order:
    pen = BoundsPen(glyphs); glyphs[name].draw(pen)
    if not pen.bounds: continue
    # TrueType: the glyph header records the box around all points (off-curve ones too); hmtx must equal it.
    want = font['glyf'][name].xMin if not cff else round(pen.bounds[0])
    if hmtx[name][1] != want:
        bad.append((name, hmtx[name][1], want))
check(not bad, 'hmtx left side bearing equals outline xMin for every glyph' + (f' (first mismatch {bad[0]})' if bad else ''))

areas = []
for ch in 'HIL':
    if ord(ch) in cmap:
        pen = AreaPen(glyphs); glyphs[cmap[ord(ch)]].draw(pen); areas.append(pen.value)
want = 'counter-clockwise (positive area)' if cff else 'clockwise (negative area)'
check(bool(areas) and all((a > 0) == cff for a in areas), f'outer contours are {want}')

name = font['name']
family, ps, version = name.getDebugName(1), name.getDebugName(6), name.getDebugName(5)
check(bool(family) and bool(ps) and re.fullmatch(r'[A-Za-z0-9-]{1,63}', ps) is not None, f'family "{family}", PostScript name "{ps}" are valid')
m = re.fullmatch(r'Version (\d+\.\d+)', version or '')
check(m is not None and abs(float(m.group(1)) - font['head'].fontRevision) < 0.0005, f'"{version}" agrees with head.fontRevision {font["head"].fontRevision:.3f}')
os2 = font['OS/2']
check(name.getDebugName(2) == 'Regular' and os2.fsSelection & 0x40 and os2.usWeightClass == 400 and font['head'].macStyle == 0, 'style Regular matches fsSelection, weight 400 and macStyle')
check(os2.usWinAscent == font['hhea'].ascent and os2.usWinDescent == -font['hhea'].descent, 'Windows ascent/descent equal hhea ascent/descent')

if '--coretext' in sys.argv:
    out = subprocess.run(['swift', 'scripts/coretext-check.swift', path], capture_output=True, text=True)
    if 'CORETEXT-REJECTED' in out.stdout or out.returncode:
        check(False, 'CoreText opens the file: ' + (out.stdout + out.stderr).strip()[:200])
    else:
        mapped = {}
        for line in out.stdout.splitlines():
            parts = line.split()
            if len(parts) == 3 and parts[0].startswith('U+') and parts[1] != 'unmapped':
                mapped[int(parts[0][2:], 16)] = float(parts[2])
        check(True, f'CoreText opens the file ({len(mapped)} ASCII characters mapped)')
        check(set(mapped) == {c for c in cmap if 32 <= c <= 126}, 'CoreText maps exactly the characters the cmap lists')
        diff = [(chr(c), a, hmtx[cmap[c]][0]) for c, a in mapped.items() if round(a) != hmtx[cmap[c]][0]]
        check(not diff, 'CoreText advance widths equal hmtx advance widths' + (f' (first mismatch {diff[0]})' if diff else ''))

print('\nFAILED' if failures else '\nALL CHECKS PASSED')
sys.exit(1 if failures else 0)
