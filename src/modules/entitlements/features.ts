/**
 * The catalogue of things a plan may decide about. This file says what a feature IS and what the product promises
 * about it; it never says which plan has it (that is configuration, see config.ts) and never says how it looks
 * when it is not available (that is presentation, see presentation.ts).
 */
export type FeatureKind = 'flag' | 'limit'

export interface FeatureDef {
  id: string
  title: string
  description: string
  kind: FeatureKind
  /**
   * Data safety. Always allowed, whatever the configuration or the grant: people must always be able to keep,
   * move and recover their own work. Essential features are also guaranteed free.
   */
  essential: boolean
  /** A promise made about the free plan: configuration validation rejects any free tier that does not grant it. */
  guaranteedFree: boolean
  /** Does it exist in the product today? Planned features are never shown anywhere in the interface. */
  implemented: boolean
  /** Where the capability is checked, for implemented features that a tier can restrict. */
  enforcedIn?: string
  /** For limits: the most the product supports at all (a limit above it is clamped). */
  ceiling?: number
}

const f = (def: FeatureDef): FeatureDef => def

export const FEATURES = [
  /* ----- data safety: never a tier decision ----- */
  f({ id: 'data.projects.local', title: 'Create, save, reopen, rename, duplicate and delete projects', description: 'Projects kept in this browser.', kind: 'flag', essential: true, guaranteedFree: true, implemented: true }),
  f({ id: 'data.export.project-file', title: 'Export a project file', description: 'The whole project as one JSON file, with a backup offered before deleting.', kind: 'flag', essential: true, guaranteedFree: true, implemented: true }),
  f({ id: 'data.import', title: 'Import a project file', description: 'Open a project file, with recovery of damaged ones.', kind: 'flag', essential: true, guaranteedFree: true, implemented: true }),
  f({ id: 'data.recovery', title: 'Recover and keep your data', description: 'Upgrade of older projects with the original kept, recovery of damaged records, raw download.', kind: 'flag', essential: true, guaranteedFree: true, implemented: true }),

  /* ----- promised free ----- */
  f({ id: 'typography.roles', title: 'Typography roles', description: 'Display, heading, body, interface and caption roles.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true }),
  f({ id: 'typography.scale', title: 'Type scale', description: 'Base size, ratio, heading and body sizes, fluid sizing.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true }),
  f({ id: 'typography.pairing.basic', title: 'Font pairing with existing fonts', description: 'Primary and secondary fonts from the catalog.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true }),
  f({ id: 'export.css', title: 'CSS export', description: 'Custom properties, classes and font declarations.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx' }),
  f({ id: 'export.docs', title: 'Documentation exports', description: 'Markdown specification, JSON tokens, sources and licences.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx' }),
  f({ id: 'typeface.family.geometric', title: 'Geometric typeface family', description: 'One of the procedural construction families.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true, enforcedIn: 'app-shell/typeface/CreateTypeface.tsx, DnaPanel.tsx' }),
  f({ id: 'glyph.edit.basic', title: 'Basic glyph editing', description: 'Select and move outline points, undo and redo, reset to the generated shape.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true }),
  f({ id: 'export.font.ttf', title: 'TrueType font export', description: 'A checked .ttf file of your typeface.', kind: 'flag', essential: false, guaranteedFree: true, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx, FontExportFlow.tsx' }),

  /* ----- configurable: shipped today, included in the launch free configuration ----- */
  f({ id: 'typeface.family.rounded', title: 'Rounded typeface family', description: 'A procedural construction family.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/typeface/CreateTypeface.tsx, DnaPanel.tsx' }),
  f({ id: 'typeface.family.modular', title: 'Modular typeface family', description: 'A procedural construction family.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/typeface/CreateTypeface.tsx, DnaPanel.tsx' }),
  f({ id: 'typeface.variants.explore', title: 'Explore design variations', description: 'Seeded variations of a design, side by side.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/typeface/VariantsTab.tsx' }),
  f({ id: 'typeface.variants.maxSaved', title: 'Saved variants', description: 'How many variants a typeface may keep. Variants already saved are never removed.', kind: 'limit', essential: false, guaranteedFree: false, implemented: true, ceiling: 60, enforcedIn: 'typeface-engine/edit.ts (saveVariant), app-shell/typeface/VariantsTab.tsx' }),
  f({ id: 'glyph.edit.structure', title: 'Add and delete outline points', description: 'Change how many points a glyph outline has.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/typeface/GlyphWorkspace.tsx' }),
  f({ id: 'glyph.edit.shape-params', title: 'Per-glyph shape settings', description: 'Stroke, width, roundness and corner settings for a single glyph.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/typeface/GlyphWorkspace.tsx' }),
  f({ id: 'quality.extended', title: 'Extended quality diagnostics', description: 'Metric consistency, advance widths and spacing checks. Checks that guard the correctness of an exported file always run.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'font-validation/quality.ts, app-shell/typeface/QualityTab.tsx' }),
  f({ id: 'export.font.otf', title: 'OpenType (CFF) font export', description: 'A checked .otf file of your typeface.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/FontExportFlow.tsx' }),
  f({ id: 'export.specimen', title: 'HTML specimen export', description: 'A self-contained page showing every role.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx' }),
  f({ id: 'export.specimen.pdf', title: 'PDF specimen export', description: 'The specimen as a PDF with real text and the fonts embedded.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx' }),
  f({ id: 'export.package', title: 'Package export', description: 'Every export in one zip.', kind: 'flag', essential: false, guaranteedFree: false, implemented: true, enforcedIn: 'app-shell/ExportPage.tsx' }),

  /* ----- planned: do not exist yet, never shown ----- */
  f({ id: 'typeface.family.expanded', title: 'Additional typeface families', description: 'More procedural construction families.', kind: 'flag', essential: false, guaranteedFree: false, implemented: false }),
  f({ id: 'typeface.weights.multiple', title: 'Additional weights and styles', description: 'More than one weight or style per typeface.', kind: 'flag', essential: false, guaranteedFree: false, implemented: false }),
  f({ id: 'glyph.edit.curves', title: 'Curve editing', description: 'Bézier handles in the glyph editor.', kind: 'flag', essential: false, guaranteedFree: false, implemented: false }),
  f({ id: 'export.specimen.extended', title: 'Extended specimen options', description: 'More specimen layouts and formats.', kind: 'flag', essential: false, guaranteedFree: false, implemented: false }),
  f({ id: 'projects.organisation', title: 'Advanced project organisation', description: 'Folders, tags and search across projects.', kind: 'flag', essential: false, guaranteedFree: false, implemented: false }),
] as const satisfies readonly FeatureDef[]

export type FeatureId = (typeof FEATURES)[number]['id']

export const FEATURE_IDS = FEATURES.map((x) => x.id) as FeatureId[]
const byId = new Map<string, FeatureDef>(FEATURES.map((x) => [x.id, x]))
export const featureDef = (id: string): FeatureDef | undefined => byId.get(id)
export const isFeatureId = (id: string): id is FeatureId => byId.has(id)
