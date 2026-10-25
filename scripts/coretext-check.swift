// Developer tool (macOS): opens a font file with CoreText, the engine behind Safari, Pages, Keynote and Apple design tools,
// then reports what it sees and renders a line of text to a PNG.
// Run: swift scripts/coretext-check.swift <font file> [out.png] [text]
// Prints "FAMILY / PS name / glyph count", then one line per character: "U+0048 glyph advance" in font units,
// so the numbers can be compared with fontTools (scripts/verify-font.py does that).
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: coretext-check.swift <font> [out.png] [text]"); exit(2) }
let url = URL(fileURLWithPath: args[1]) as CFURL
guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url) as? [CTFontDescriptor], let descriptor = descriptors.first else {
  print("CORETEXT-REJECTED: CoreText could not read \(args[1])"); exit(1)
}
let font = CTFontCreateWithFontDescriptor(descriptor, 1000, nil)
print("FAMILY \(CTFontCopyFamilyName(font) as String)")
print("PSNAME \(CTFontCopyPostScriptName(font) as String)")
print("GLYPHS \(CTFontGetGlyphCount(font))")
print("UPM \(CTFontGetUnitsPerEm(font))")
print("ASCENT \(CTFontGetAscent(font)) DESCENT \(CTFontGetDescent(font)) LEADING \(CTFontGetLeading(font))")
for scalar in 32...126 {
  var ch = UniChar(scalar)
  var glyph = CGGlyph(0)
  let mapped = CTFontGetGlyphsForCharacters(font, &ch, &glyph, 1)
  if mapped && glyph != 0 {
    var advance = CGSize.zero
    CTFontGetAdvancesForGlyphs(font, .horizontal, &glyph, &advance, 1)
    print(String(format: "U+%04X %d %.0f", scalar, glyph, advance.width))
  } else {
    print(String(format: "U+%04X unmapped", scalar))
  }
}

if args.count >= 3 {
  let text = args.count >= 4 ? args[3] : "HAMBURG Hand 0123"
  let size: CGFloat = 120
  let sized = CTFontCreateWithFontDescriptor(descriptor, size, nil)
  let attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): sized, NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String): true]
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
  let bounds = CTLineGetImageBounds(line, nil)
  let width = Int(ceil(bounds.width)) + 80
  let height = Int(size * 1.6)
  let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  ctx.setFillColor(gray: 1, alpha: 1)
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  ctx.setFillColor(gray: 0, alpha: 1)
  ctx.textPosition = CGPoint(x: 40, y: size * 0.45)
  CTLineDraw(line, ctx)
  let image = ctx.makeImage()!
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, image, nil)
  CGImageDestinationFinalize(dest)
  print("RENDERED \(args[2])")
}
