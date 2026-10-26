import type { Project } from '@/modules/brand-projects/schema'

/** The brand's own name, or the project's name when none is set. */
export const brandName = (p: Pick<Project, 'name' | 'brand'>): string => p.brand.name.trim() || p.name

export const USE_CASE_LABEL = { saas: 'SaaS and software', editorial: 'Editorial', consumer: 'Consumer products', campaign: 'Campaigns', corporate: 'Corporate' } as const
export const TONE_LABEL = { confident: 'Confident', friendly: 'Friendly', technical: 'Technical', elegant: 'Elegant', playful: 'Playful', serious: 'Serious' } as const
export const PRIORITY_LABEL = ['', 'Low', 'Fairly low', 'Medium', 'Fairly high', 'High'] as const

/** True when the brand direction has enough in it to be called defined. */
export const brandDefined = (p: Pick<Project, 'brand'>): boolean =>
  p.brand.name.trim() !== '' || p.brand.description.trim() !== '' || p.brand.personality.length > 0 || p.brand.tones.length > 0 || p.brand.useCases.length > 0
