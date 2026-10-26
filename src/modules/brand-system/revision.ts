import type { Project } from '@/modules/brand-projects/schema'

/** JSON with sorted keys, so equal content always serialises equally whatever order its keys were built in. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * The part of a project that exports are built from. Name, id and timestamps are included only where they appear
 * in an export (the name); export history and `updatedAt` are not, so recording an export does not make every
 * earlier export look out of date.
 */
export function exportedContent(p: Project) {
  return { name: p.name, brand: p.brand, typography: p.typography, fontSources: p.fontSources, customTypeface: p.customTypeface }
}

/** 12 hex characters identifying the saved content that an export reflects. */
export async function contentRevision(p: Project): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(exportedContent(p)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
}
