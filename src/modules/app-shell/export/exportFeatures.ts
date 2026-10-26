import type { ExportFileId } from '@/modules/export-centre/types'
import type { FeatureId } from '@/modules/entitlements'

/**
 * Which feature each export belongs to. The export generators know nothing about plans; this table is the only
 * place that connects an export to an entitlement. The project file is an essential data feature, so it is
 * always available.
 */
export const EXPORT_FEATURE: Record<ExportFileId, FeatureId> = {
  spec: 'export.docs',
  tokens: 'export.docs',
  manifest: 'export.docs',
  css: 'export.css',
  specimen: 'export.specimen',
  package: 'export.package',
  font: 'export.font.ttf',
  project: 'data.export.project-file',
}
