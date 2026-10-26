import { useEffect, useState, type ReactNode } from 'react'
import { ProjectService } from '@/modules/brand-projects/service'
import { openRepository } from '@/modules/persistence/repositories'

import { EntitlementsProvider } from './EntitlementsProvider'
import { StudioCtx, type Studio } from './studio'

/** Opens browser storage once and exposes the project service. Falls back to memory with a visible warning. */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [studio, setStudio] = useState<Studio | null>(null)
  useEffect(() => {
    let cancelled = false
    void openRepository().then(({ repo, warning }) => {
      if (!cancelled) setStudio({ service: new ProjectService(repo), storageKind: repo.kind, storageWarning: warning })
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!studio) return <p className="p-8 text-sm text-ink-soft" role="status">Opening your local workspace…</p>
  return (
    <StudioCtx.Provider value={studio}>
      <EntitlementsProvider>{children}</EntitlementsProvider>
    </StudioCtx.Provider>
  )
}
