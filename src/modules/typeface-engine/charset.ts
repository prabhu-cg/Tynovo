/**
 * The characters this engine aims to cover, and the names they get inside a font.
 * A character counts as supported only when a recipe exists AND its generated outline passes validation;
 * see coverage.ts. Nothing here claims support.
 */
export interface CharGroup {
  id: 'upper' | 'lower' | 'digits' | 'punctuation' | 'space'
  label: string
  chars: string
}

export const GROUPS: readonly CharGroup[] = [
  { id: 'upper', label: 'Uppercase A–Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'lower', label: 'Lowercase a–z', chars: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'digits', label: 'Digits 0–9', chars: '0123456789' },
  { id: 'punctuation', label: 'Punctuation and symbols', chars: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' },
  { id: 'space', label: 'Space', chars: ' ' },
]

export const TARGET_CHARS: readonly string[] = GROUPS.flatMap((g) => [...g.chars])

/** Adobe Glyph List names for ASCII punctuation; letters keep their own letter. */
const PUNCT_NAMES: Record<string, string> = {
  ' ': 'space', '!': 'exclam', '"': 'quotedbl', '#': 'numbersign', $: 'dollar', '%': 'percent', '&': 'ampersand', "'": 'quotesingle',
  '(': 'parenleft', ')': 'parenright', '*': 'asterisk', '+': 'plus', ',': 'comma', '-': 'hyphen', '.': 'period', '/': 'slash',
  ':': 'colon', ';': 'semicolon', '<': 'less', '=': 'equal', '>': 'greater', '?': 'question', '@': 'at', '[': 'bracketleft',
  '\\': 'backslash', ']': 'bracketright', '^': 'asciicircum', _: 'underscore', '`': 'grave', '{': 'braceleft', '|': 'bar',
  '}': 'braceright', '~': 'asciitilde',
}
const DIGIT_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

export function glyphName(char: string): string {
  if (/^[A-Za-z]$/.test(char)) return char
  if (/^[0-9]$/.test(char)) return DIGIT_NAMES[Number(char)]!
  const n = PUNCT_NAMES[char]
  if (n) return n
  return `uni${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
}

export const groupOf = (char: string): CharGroup['id'] | null => GROUPS.find((g) => g.chars.includes(char))?.id ?? null
