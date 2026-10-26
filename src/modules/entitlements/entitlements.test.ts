import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, assertValidConfig, tierGrants, validateConfig, type EntitlementConfig } from './config'
import { FEATURES, FEATURE_IDS, featureDef, type FeatureId } from './features'
import { COMMERCE, lockedMessage, viewOf, whenLocked } from './presentation'
import { resolveCapabilities, type Grant } from './resolve'
import { currentGrant, defaultGrant, devPreviewGrant } from './source'

const free: Grant = defaultGrant('free')
const clone = (): EntitlementConfig => structuredClone(DEFAULT_CONFIG)

/** A configuration that actually restricts things, to prove the switches work. Built from data only. */
function restrictive(): EntitlementConfig {
  const c = clone()
  const g = c.tiers['free']!.grants
  for (const id of ['typeface.family.rounded', 'typeface.family.modular', 'typeface.variants.explore', 'glyph.edit.structure', 'glyph.edit.shape-params', 'quality.extended', 'export.font.otf', 'export.specimen', 'export.package'] as const) g[id] = false
  g['typeface.variants.maxSaved'] = 3
  c.tiers['paid'] = { label: 'Plus', extends: 'free', grants: { 'typeface.family.rounded': true, 'typeface.family.modular': true, 'typeface.variants.maxSaved': 60, 'quality.extended': true } }
  return c
}

describe('the feature registry', () => {
  it('has unique ids, titles and a description for everything', () => {
    expect(new Set(FEATURE_IDS).size).toBe(FEATURES.length)
    for (const f of FEATURES) {
      expect(f.title.length, f.id).toBeGreaterThan(3)
      expect(f.description.length, f.id).toBeGreaterThan(5)
    }
  })

  it('protects data: every essential feature is also promised free and exists today', () => {
    const essential = FEATURES.filter((f) => f.essential)
    expect(essential.map((f) => f.id)).toEqual(['data.projects.local', 'data.export.project-file', 'data.import', 'data.recovery'])
    for (const f of essential) {
      expect(f.guaranteedFree, f.id).toBe(true)
      expect(f.implemented, f.id).toBe(true)
      expect(f.kind, f.id).toBe('flag')
    }
  })

  it('promises the free tier what the product brief promises: local projects, roles, scale, pairing, core exports, a family, basic editing, font export', () => {
    const promised = FEATURES.filter((f) => f.guaranteedFree).map((f) => f.id)
    for (const id of ['typography.roles', 'typography.scale', 'typography.pairing.basic', 'export.css', 'export.docs', 'typeface.family.geometric', 'glyph.edit.basic', 'export.font.ttf', 'data.export.project-file', 'data.recovery'] as FeatureId[]) expect(promised).toContain(id)
  })

  it('names where every restrictable, implemented feature is enforced, and limits have a ceiling', () => {
    for (const f of FEATURES) {
      if (f.implemented && !f.essential && !f.guaranteedFree) expect(f.enforcedIn, f.id).toBeTruthy()
      if (f.kind === 'limit') expect(f.ceiling, f.id).toBeGreaterThan(0)
      if (!f.implemented) expect(f.guaranteedFree || f.essential, `${f.id} is planned, so it cannot be promised`).toBe(false)
    }
  })
})

describe('the shipped configuration', () => {
  it('is valid', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([])
  })

  it('takes nothing away from today: every implemented feature is in the free tier, and planned ones are not', () => {
    const g = tierGrants(DEFAULT_CONFIG, 'free')
    for (const f of FEATURES) {
      if (f.implemented) expect(g[f.id], f.id).toBe(f.kind === 'limit' ? f.ceiling : true)
      else expect(g[f.id], f.id).toBeUndefined()
    }
  })

  it('holds no prices, currencies or billing terms', () => {
    expect(JSON.stringify(DEFAULT_CONFIG)).not.toMatch(/[$€£¥]|price|usd|eur|monthly|annual|per month|per year|billing|trial/i)
  })

  it('the paid placeholder only adds features that do not exist yet', () => {
    const paid = tierGrants(DEFAULT_CONFIG, 'paid')
    const free = tierGrants(DEFAULT_CONFIG, 'free')
    const extra = Object.keys(paid).filter((k) => paid[k] !== free[k])
    expect(extra.length).toBeGreaterThan(0)
    for (const id of extra) expect(featureDef(id)!.implemented, id).toBe(false)
  })
})

describe('configuration validation protects the promises', () => {
  const problems = (mutate: (c: EntitlementConfig) => void) => {
    const c = clone()
    mutate(c)
    return validateConfig(c).map((p) => `${p.path}: ${p.message}`)
  }

  it('refuses to restrict essential data features, by any tier', () => {
    expect(problems((c) => (c.tiers['free']!.grants['data.recovery'] = false)).join('\n')).toMatch(/data\.recovery.*can never be restricted/)
    expect(problems((c) => (c.tiers['paid']!.grants['data.export.project-file'] = false)).join('\n')).toMatch(/data\.export\.project-file/)
  })

  it('refuses a free tier that drops a feature the product promises is free', () => {
    expect(problems((c) => (c.tiers['free']!.grants['export.css'] = false)).join('\n')).toMatch(/free tier must include "export\.css"/)
    expect(problems((c) => delete c.tiers['free']!.grants['glyph.edit.basic']).join('\n')).toMatch(/glyph\.edit\.basic/)
    expect(problems((c) => (c.tiers['free']!.grants['export.font.ttf'] = false)).join('\n')).toMatch(/export\.font\.ttf/)
  })

  it('refuses a paid tier that takes away a promised feature', () => {
    expect(problems((c) => (c.tiers['paid']!.grants['typography.scale'] = false)).join('\n')).toMatch(/must not take away "typography\.scale"/)
  })

  it('refuses unknown features, wrong value types, bad references and cycles', () => {
    expect(problems((c) => (c.tiers['free']!.grants['made.up'] = true)).join('\n')).toMatch(/not a known feature/)
    expect(problems((c) => (c.tiers['free']!.grants['quality.extended'] = 3)).join('\n')).toMatch(/on or off/)
    expect(problems((c) => (c.tiers['free']!.grants['typeface.variants.maxSaved'] = true)).join('\n')).toMatch(/is a number/)
    expect(problems((c) => (c.tiers['free']!.grants['typeface.variants.maxSaved'] = -1)).length).toBeGreaterThan(0)
    expect(problems((c) => (c.defaultTier = 'gone')).join('\n')).toMatch(/not defined/)
    expect(problems((c) => (c.tiers['paid']!.extends = 'ghost')).join('\n')).toMatch(/extends "ghost"/)
    expect(problems((c) => { c.tiers['free']!.extends = 'paid' }).join('\n')).toMatch(/cycle/)
    expect(validateConfig({ version: 2 }).length).toBeGreaterThan(0)
    expect(validateConfig('nope').length).toBeGreaterThan(0)
  })

  it('accepts a configuration that restricts only what may be restricted', () => {
    expect(validateConfig(restrictive())).toEqual([])
  })

  it('assertValidConfig throws with every problem listed', () => {
    const c = clone()
    c.tiers['free']!.grants['export.css'] = false
    expect(() => assertValidConfig(c)).toThrow(/export\.css/)
  })
})

describe('resolving capabilities', () => {
  it('free users keep everything shipped today', () => {
    const caps = resolveCapabilities(DEFAULT_CONFIG, free)
    for (const f of FEATURES) if (f.implemented) expect(caps.allows(f.id), f.id).toBe(true)
    expect(caps.limit('typeface.variants.maxSaved')).toBe(60)
    expect(caps.label).toBe('Free')
  })

  it('the same inputs always give the same answers', () => {
    const a = resolveCapabilities(restrictive(), free)
    const b = resolveCapabilities(restrictive(), free)
    for (const id of FEATURE_IDS) expect(a.decide(id)).toEqual(b.decide(id))
  })

  it('a restrictive configuration turns features off and limits down, and says why', () => {
    const caps = resolveCapabilities(restrictive(), free)
    expect(caps.allows('typeface.family.rounded')).toBe(false)
    expect(caps.decide('typeface.family.rounded')).toEqual({ allowed: false, reason: 'not-granted' })
    expect(caps.limit('typeface.variants.maxSaved')).toBe(3)
    expect(caps.limit('typeface.family.rounded')).toBe(0)
    expect(caps.limit('typeface.family.geometric')).toBe(1)
    expect(caps.allows('typeface.family.geometric')).toBe(true)
  })

  it('essential features are allowed whatever happens', () => {
    for (const grant of [free, { tier: 'nope', trusted: false, source: 'local-default' as const, preview: false }]) {
      const caps = resolveCapabilities(restrictive(), grant)
      for (const f of FEATURES.filter((x) => x.essential)) expect(caps.decide(f.id)).toEqual({ allowed: true, reason: 'essential' })
    }
  })

  it('unknown features are denied', () => {
    const caps = resolveCapabilities(DEFAULT_CONFIG, free)
    expect(caps.allows('not.a.feature' as FeatureId)).toBe(false)
    expect(caps.decide('not.a.feature' as FeatureId).reason).toBe('unknown-feature')
    expect(caps.limit('not.a.feature' as FeatureId)).toBe(0)
  })

  it('a limit above the product ceiling is clamped to it', () => {
    const c = clone()
    c.tiers['free']!.grants['typeface.variants.maxSaved'] = 5000
    expect(resolveCapabilities(c, free).limit('typeface.variants.maxSaved')).toBe(60)
  })

  it('refuses to run on an invalid configuration', () => {
    const c = clone()
    c.tiers['free']!.grants['export.font.ttf'] = false
    expect(() => resolveCapabilities(c, free)).toThrow(/export\.font\.ttf/)
  })
})

describe('a claim the browser makes is never proof of payment', () => {
  const claim: Grant = { tier: 'paid', trusted: false, source: 'local-default', preview: false }

  it('an untrusted claim for a paid tier is ignored, and the person stays on the default tier', () => {
    const caps = resolveCapabilities(restrictive(), claim)
    expect(caps.tier).toBe('free')
    expect(caps.downgraded).toBe(true)
    expect(caps.allows('quality.extended')).toBe(false)
    expect(caps.limit('typeface.variants.maxSaved')).toBe(3)
  })

  it('only a trusted grant reaches the paid tier', () => {
    const caps = resolveCapabilities(restrictive(), { ...claim, trusted: true, source: 'server' as const })
    expect(caps.tier).toBe('paid')
    expect(caps.downgraded).toBe(false)
    expect(caps.allows('quality.extended')).toBe(true)
    expect(caps.limit('typeface.variants.maxSaved')).toBe(60)
    expect(caps.allows('export.package')).toBe(false) // paid in this test configuration adds only what it lists
  })

  it('a grant naming a tier that does not exist falls back to the default tier', () => {
    expect(resolveCapabilities(restrictive(), { tier: 'platinum', trusted: true, source: 'server', preview: false }).tier).toBe('free')
  })

  it('nothing in the page, storage or address can produce a trusted grant in a production build', () => {
    // currentGrant reads the address only in development builds, and then only to preview a tier.
    expect(currentGrant('free')).toEqual({ tier: 'free', trusted: true, source: 'local-default', preview: false })
    expect(() => devPreviewGrant('paid', { DEV: false })).toThrow(/development builds/)
    expect(devPreviewGrant('paid', { DEV: true })).toEqual({ tier: 'paid', trusted: true, source: 'dev-preview', preview: true })
  })
})

describe('presentation is separate from capability', () => {
  const caps = resolveCapabilities(restrictive(), free)

  it('an allowed feature is visible and unlocked', () => {
    expect(viewOf('typeface.family.geometric', caps)).toEqual({ allowed: true, visible: true, locked: false, message: null })
  })

  it('a restricted feature is shown locked by default, with a plain explanation', () => {
    const v = viewOf('typeface.family.rounded', caps)
    expect(v).toMatchObject({ allowed: false, visible: true, locked: true })
    expect(v.message).toBe('Rounded typeface family is not included in the Free plan. Paid plans are not available yet.')
  })

  it('capability does not change when only the presentation does', () => {
    expect(whenLocked('typeface.family.rounded')).toBe('show-locked')
    expect(caps.allows('typeface.family.rounded')).toBe(false)
  })

  it('says paid plans do not exist, because no payment integration does, and offers no purchase wording', () => {
    expect(COMMERCE.paymentsAvailable).toBe(false)
    for (const f of FEATURES) {
      const m = lockedMessage(f.id, { label: 'Free' })
      expect(m, f.id).toMatch(/Paid plans are not available yet\.$/)
      expect(m, f.id).not.toMatch(/[$€£]|buy|purchase|checkout|subscribe|upgrade|sign in|log in|pricing|trial|discount|offer/i)
    }
  })
})
