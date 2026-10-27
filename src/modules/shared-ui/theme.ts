import { useEffect, useState } from 'react'

/**
 * The colour theme: light, dark, or follow the system (the default). The choice is one value in localStorage
 * (`tynovo.theme`), written only when the person picks Light or Dark; picking System removes it. If the browser blocks
 * storage the choice holds for the visit, from memory. /theme-init.js applies the same rule before first paint.
 */
export const THEME_KEY = 'tynovo.theme'
export type ThemePreference = 'system' | 'light' | 'dark'

let remembered: ThemePreference | null = null

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
    return remembered ?? 'system'
  } catch {
    return remembered ?? 'system'
  }
}

function writePreference(p: ThemePreference): void {
  remembered = p
  try {
    if (p === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, p)
  } catch {
    /* blocked or full: held in memory for this visit */
  }
}

const systemDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

/** What is actually shown. */
export const resolveTheme = (p: ThemePreference): 'light' | 'dark' => (p === 'dark' || (p === 'system' && systemDark()) ? 'dark' : 'light')

const apply = (p: ThemePreference) => document.documentElement.setAttribute('data-theme', resolveTheme(p))

/** The current preference and a setter that applies and remembers it. Follows the system while the preference is System. */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  useEffect(() => {
    apply(preference)
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => apply('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [preference])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPreference(readPreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return [preference, (next) => { writePreference(next); setPreference(next) }]
}
