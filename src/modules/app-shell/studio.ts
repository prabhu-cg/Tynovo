import { createContext, useContext } from 'react'
import type { ProjectService } from '@/modules/brand-projects/service'

export interface Studio {
  service: ProjectService
  storageKind: 'indexeddb' | 'memory'
  storageWarning: string | null
}

export const StudioCtx = createContext<Studio | null>(null)

export function useStudio(): Studio {
  const v = useContext(StudioCtx)
  if (!v) throw new Error('useStudio must be used inside <StudioProvider>')
  return v
}
