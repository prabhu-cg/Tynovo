import { useMemo, type ReactNode } from 'react'
import { DEFAULT_CONFIG, currentGrant, resolveCapabilities, type EntitlementConfig, type Grant } from '@/modules/entitlements'
import { EntitlementsCtx } from './entitlements'

/**
 * Resolves the person's capabilities once and shares them. The configuration and the grant can be injected
 * (tests do); by default it is the shipped configuration and the grant the page load has, which in a
 * production build is always the default tier because nothing in the browser can prove anything else.
 */
export function EntitlementsProvider({ children, config = DEFAULT_CONFIG, grant }: { children: ReactNode; config?: EntitlementConfig; grant?: Grant }) {
  const caps = useMemo(() => resolveCapabilities(config, grant ?? currentGrant(config.defaultTier)), [config, grant])
  return <EntitlementsCtx.Provider value={caps}>{children}</EntitlementsCtx.Provider>
}
