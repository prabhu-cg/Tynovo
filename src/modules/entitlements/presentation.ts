import { featureDef, type FeatureId } from './features'
import type { Capabilities } from './resolve'

/**
 * How the interface treats a feature that is not available. This is separate from whether it is available
 * (resolve.ts): capability decides what can happen, presentation decides what people see.
 *
 *   show-locked  the control stays, disabled, with a plain explanation
 *   hide         the control is not drawn
 *
 * User data is never hidden by presentation: what a person already made stays visible and exportable.
 */
export type WhenLocked = 'show-locked' | 'hide'

export const DEFAULT_WHEN_LOCKED: WhenLocked = 'show-locked'

/** Per-feature overrides. Everything not listed uses the default. */
export const PRESENTATION: Partial<Record<FeatureId, { whenLocked: WhenLocked }>> = {}

/**
 * Facts about commerce in this build. `paymentsAvailable` is a statement about the code, not a switch: it is false
 * because no payment integration exists, and it stays false until one does. The interface reads it so that it
 * never implies a way to pay that is not there. There is no purchase, upgrade or sign-in control anywhere.
 */
export const COMMERCE = { paymentsAvailable: false } as const

export function whenLocked(feature: FeatureId): WhenLocked {
  return PRESENTATION[feature]?.whenLocked ?? DEFAULT_WHEN_LOCKED
}

/** The sentence shown where a feature is unavailable. No prices, no calls to action. */
export function lockedMessage(feature: FeatureId, caps: Pick<Capabilities, 'label'>): string {
  const title = featureDef(feature)?.title ?? 'This feature'
  return `${title} is not included in the ${caps.label} plan.${COMMERCE.paymentsAvailable ? '' : ' Paid plans are not available yet.'}`
}

export interface FeatureView {
  allowed: boolean
  /** Whether to draw the control at all. */
  visible: boolean
  locked: boolean
  message: string | null
}

export function viewOf(feature: FeatureId, caps: Capabilities): FeatureView {
  const allowed = caps.allows(feature)
  if (allowed) return { allowed, visible: true, locked: false, message: null }
  return { allowed, visible: whenLocked(feature) === 'show-locked', locked: true, message: lockedMessage(feature, caps) }
}
