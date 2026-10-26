import { z } from 'zod'
import { FEATURES, featureDef, FEATURE_IDS, type FeatureId } from './features'

/**
 * Tier configuration: DATA, with no behaviour. It says which plan grants which feature and how plans are named.
 * Nothing in the product branches on a plan's name: code asks about features (resolve.ts). Prices, billing periods
 * and currencies deliberately have no field here; they belong to a payment provider, not to the application.
 *
 * The configuration is validated (validateConfig) so a mistake, a bad edit or a future remote file cannot break
 * the promises the product makes: essential data features are never restricted, and the free tier always grants
 * the features the product has promised to keep free.
 */
const grantSchema = z.union([z.boolean(), z.number().int().min(0)])

export const tierSchema = z.object({
  label: z.string().min(1).max(40),
  /** Another tier whose grants this one starts from. */
  extends: z.string().optional(),
  grants: z.record(z.string(), grantSchema),
})

export const configSchema = z.object({
  version: z.literal(1),
  /** The tier everyone has unless a trusted grant says otherwise. It must guarantee the free promises. */
  defaultTier: z.string().min(1),
  tiers: z.record(z.string(), tierSchema),
})

export type Grant = z.infer<typeof grantSchema>
export type Tier = z.infer<typeof tierSchema>
export type EntitlementConfig = z.infer<typeof configSchema>

/** Every implemented feature is granted at the free tier at launch: no shipped feature is taken away. */
function launchFreeGrants(): Record<string, Grant> {
  const grants: Record<string, Grant> = {}
  for (const def of FEATURES) {
    if (!def.implemented) continue
    grants[def.id] = def.kind === 'limit' ? (def.ceiling ?? 0) : true
  }
  return grants
}

/**
 * The configuration the application ships with. The "paid" tier is a placeholder that shows how a premium plan
 * would extend the free one; no code path can reach it without a trusted grant, and none exists (see resolve.ts).
 */
export const DEFAULT_CONFIG: EntitlementConfig = {
  version: 1,
  defaultTier: 'free',
  tiers: {
    free: { label: 'Free', grants: launchFreeGrants() },
    paid: {
      label: 'Paid',
      extends: 'free',
      grants: Object.fromEntries(FEATURES.filter((x) => !x.implemented).map((x) => [x.id, true])),
    },
  },
}

export interface ConfigProblem {
  path: string
  message: string
}

/** Effective grants of a tier: its parents' grants first, then its own. Throws on a cycle or an unknown parent. */
export function tierGrants(config: EntitlementConfig, tierId: string): Record<string, Grant> {
  const chain: Tier[] = []
  const seen = new Set<string>()
  let id: string | undefined = tierId
  while (id !== undefined) {
    if (seen.has(id)) throw new Error(`Tier "${id}" extends itself through a cycle.`)
    seen.add(id)
    const t: Tier | undefined = config.tiers[id]
    if (!t) throw new Error(`Unknown tier "${id}".`)
    chain.unshift(t)
    id = t.extends
  }
  return Object.assign({}, ...chain.map((t) => t.grants)) as Record<string, Grant>
}

/** Everything wrong with a configuration, in plain words. Empty means it is safe to use. */
export function validateConfig(input: unknown): ConfigProblem[] {
  const parsed = configSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }))
  const config = parsed.data
  const problems: ConfigProblem[] = []
  const add = (path: string, message: string) => problems.push({ path, message })

  if (!config.tiers[config.defaultTier]) add('defaultTier', `The default tier "${config.defaultTier}" is not defined.`)
  for (const [tid, tier] of Object.entries(config.tiers)) {
    if (tier.extends !== undefined && !config.tiers[tier.extends]) add(`tiers.${tid}.extends`, `Tier "${tid}" extends "${tier.extends}", which is not defined.`)
    for (const [fid, grant] of Object.entries(tier.grants)) {
      const def = featureDef(fid)
      const path = `tiers.${tid}.grants.${fid}`
      if (!def) {
        add(path, `"${fid}" is not a known feature.`)
        continue
      }
      if (def.kind === 'flag' && typeof grant !== 'boolean') add(path, `"${fid}" is on or off; a number does not apply.`)
      if (def.kind === 'limit' && typeof grant !== 'number') add(path, `"${fid}" is a number (a limit); true or false does not apply.`)
      if (def.essential && grant !== true) add(path, `"${fid}" protects people's own data and can never be restricted.`)
    }
  }
  if (problems.length > 0) return problems

  // The free promises hold for the default tier, and every other tier extends from it so they hold there too.
  try {
    for (const tid of Object.keys(config.tiers)) tierGrants(config, tid)
  } catch (e) {
    add('tiers', e instanceof Error ? e.message : 'A tier is not valid.')
    return problems
  }
  const free = tierGrants(config, config.defaultTier)
  for (const def of FEATURES) {
    if (!def.guaranteedFree) continue
    const g = free[def.id]
    if (def.kind === 'flag' ? g !== true : typeof g !== 'number' || g < 1) add(`tiers.${config.defaultTier}.grants.${def.id}`, `The free tier must include "${def.id}": the product promises it stays free.`)
  }
  for (const [tid] of Object.entries(config.tiers)) {
    if (tid === config.defaultTier) continue
    const g = tierGrants(config, tid)
    for (const def of FEATURES) {
      if (def.guaranteedFree && g[def.id] !== free[def.id] && (def.kind === 'flag' ? g[def.id] !== true : (g[def.id] as number) < (free[def.id] as number))) {
        add(`tiers.${tid}.grants.${def.id}`, `A paid tier must not take away "${def.id}", which the free tier promises.`)
      }
    }
  }
  return problems
}

export const assertValidConfig = (config: unknown): EntitlementConfig => {
  const problems = validateConfig(config)
  if (problems.length > 0) throw new Error(`Invalid entitlement configuration:\n${problems.map((p) => `- ${p.path}: ${p.message}`).join('\n')}`)
  return configSchema.parse(config)
}

export { FEATURE_IDS }
export type { FeatureId }
