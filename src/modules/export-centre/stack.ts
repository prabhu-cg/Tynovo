/** Split a CSS font-family list (as built by brand-system/fonts) back into plain family names. */
export function stackList(stack: string): string[] {
  const out: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"|([^,\s][^,]*)/g
  for (const m of stack.matchAll(re)) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]!.trim())
  return out
}
