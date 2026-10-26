import { assertValidConfig, tierGrants, type EntitlementConfig } from './config'
import { featureDef, type FeatureId } from './features'

/**
 * A grant says which tier a person is entitled to, and whether that claim can be believed.
 *
 *   trusted: false  a claim made by something the browser controls. It can never unlock anything beyond the default tier.
 *   trusted: true   a claim backed by proof the application can check. Today nothing can produce one in a production
 *                   build (there is no account and no server), so the only trusted grants come from development
 *                   previews (see source.ts) and from tests.
 */
export interface Grant {
  tier: string
  trusted: boolean
  source: 'local-default' | 'dev-preview' | 'server'
  /** True only for a development preview. A plain flag, so production code never needs the preview's name. */
  preview: boolean
}

export type Reason = 'essential' | 'granted' | 'not-granted' | 'unknown-feature'

export interface Decision {
  allowed: boolean
  reason: Reason
}

export interface Capabilities {
  /** The tier actually in effect. */
  readonly tier: string
  readonly label: string
  /** True when the grant named a tier that was ignored because the claim could not be trusted. */
  readonly downgraded: boolean
  readonly grant: Grant
  allows(feature: FeatureId): boolean
  /** The numeric limit for a limit feature, 0 if it is not granted. Flags answer 1 or 0. */
  limit(feature: FeatureId): number
  decide(feature: FeatureId): Decision
}

/** Decide what a grant allows under a configuration. Pure: the same inputs always give the same answers. */
export function resolveCapabilities(configInput: EntitlementConfig, grant: Grant): Capabilities {
  const config = assertValidConfig(configInput)
  const wanted = config.tiers[grant.tier] ? grant.tier : config.defaultTier
  // An untrusted claim for any tier other than the default is ignored. This is the whole trust rule.
  const claimsMore = wanted !== config.defaultTier
  const tier = grant.trusted ? wanted : config.defaultTier
  const grants = tierGrants(config, tier)

  const decide = (feature: FeatureId): Decision => {
    const def = featureDef(feature)
    if (!def) return { allowed: false, reason: 'unknown-feature' }
    if (def.essential) return { allowed: true, reason: 'essential' }
    const g = grants[feature]
    const allowed = def.kind === 'limit' ? typeof g === 'number' && g > 0 : g === true
    return { allowed, reason: allowed ? 'granted' : 'not-granted' }
  }
  return {
    tier,
    label: config.tiers[tier]!.label,
    downgraded: !grant.trusted && claimsMore,
    grant,
    allows: (feature) => decide(feature).allowed,
    decide,
    limit(feature) {
      const def = featureDef(feature)
      if (!def) return 0
      if (def.kind === 'flag') return decide(feature).allowed ? 1 : 0
      const g = grants[feature]
      const n = typeof g === 'number' ? g : 0
      return Math.min(n, def.ceiling ?? n)
    },
  }
}
