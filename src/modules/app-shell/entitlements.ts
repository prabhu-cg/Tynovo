import { createContext, useContext } from 'react'
import type { Capabilities, FeatureId, FeatureView } from '@/modules/entitlements'
import { viewOf } from '@/modules/entitlements'

export const EntitlementsCtx = createContext<Capabilities | null>(null)

/** What the current person may do. Components ask about features, never about plan names. */
export function useCapabilities(): Capabilities {
  const v = useContext(EntitlementsCtx)
  if (!v) throw new Error('useCapabilities must be used inside <EntitlementsProvider>')
  return v
}

/** Availability and presentation of one feature: whether it works, whether to draw it, and what to say when it is locked. */
export function useFeature(id: FeatureId): FeatureView {
  return viewOf(id, useCapabilities())
}
