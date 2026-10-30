// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOG } from '@/modules/font-catalog/catalog'
import { CATALOG_SIZE } from './content'
import { SOFTWARE } from './LicensingPage'

const pkg = (name: string) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')) as { license: string }

describe('the licensing page states what is really bundled', () => {
  it('lists software with the licence each installed package declares', () => {
    const declared: Record<string, string[]> = {
      'Font Flux JS': ['font-flux-js'],
      'React and React DOM': ['react', 'react-dom'],
      'React Router': ['react-router'],
      Zod: ['zod'],
      idb: ['idb'],
      'polygon-clipping': ['polygon-clipping'],
      brotli: ['brotli'],
    }
    expect(SOFTWARE.map((s) => s.name).sort()).toEqual(Object.keys(declared).sort())
    for (const s of SOFTWARE) for (const name of declared[s.name]!) expect(pkg(name).license, name).toBe(s.license)
  })

  it('covers every runtime dependency that is not a font', () => {
    const deps = Object.keys((JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }).dependencies).filter((d) => !d.startsWith('@fontsource'))
    const listed = new Set(['font-flux-js', 'react', 'react-dom', 'react-router', 'zod', 'idb', 'polygon-clipping', 'brotli'])
    expect(deps.sort()).toEqual([...listed].sort())
  })

  it('the app is GPL-3.0-only, and so is its one GPL dependency, as the page says', () => {
    expect((JSON.parse(readFileSync('package.json', 'utf8')) as { license: string }).license).toBe('GPL-3.0-only')
    expect(SOFTWARE.find((s) => s.name === 'Font Flux JS')!.license).toBe('GPL-3.0-only')
    expect(readFileSync('LICENSE', 'utf8')).toContain('GNU GENERAL PUBLIC LICENSE')
  })

  it('the catalog size the site states is the size of the generated catalog', () => {
    expect(CATALOG_SIZE).toBe(CATALOG.length)
  })

  it('every bundled font in the table is OFL-1.1 with a copyright line', () => {
    for (const f of CATALOG) {
      expect(f.license.spdx, f.id).toBe('OFL-1.1')
      expect(f.license.copyright.length, f.id).toBeGreaterThan(3)
    }
  })
})
