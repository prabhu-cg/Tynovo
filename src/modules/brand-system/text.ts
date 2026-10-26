/** Escaping for the text formats the export centre writes. User-supplied strings must never change a file's structure. */

/** A CSS string literal, including the quotes. */
export function cssString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (ch === '"' || ch === '\\') out += `\\${ch}`
    else if (c < 0x20 || c === 0x7f) out += `\\${c.toString(16)} `
    else out += ch
  }
  return `${out}"`
}

/** Text that is safe inside a /* … *\/ comment, on one line. */
export const cssComment = (s: string): string => s.replace(/\s+/g, ' ').replace(/\*\//g, '* /').replace(/\/\*/g, '/ *').trim()

/** A CSS-identifier-safe slug: lowercase letters, digits and hyphens. */
export const slug = (s: string, fallback = 'item'): string =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Inline Markdown text: neutralise characters that would start emphasis, links, code, HTML or table cells. */
export function mdInline(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/[\\`*_{}[\]<>|#]/g, (m) => `\\${m}`).trim()
}

/** A multi-line user note as a Markdown blockquote. */
export function mdQuote(s: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => `> ${l.replace(/[\\`*_<>]/g, (m) => `\\${m}`)}`.trimEnd())
    .join('\n')
}

/** Safe file-name stem. */
export const fileStem = (s: string): string => slug(s, 'project')
