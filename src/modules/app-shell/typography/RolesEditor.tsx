import { useMemo, useState } from 'react'
import { ROLE_KINDS, type RoleKind } from '@/modules/brand-projects/schema'
import { CATALOG } from '@/modules/font-catalog/catalog'
import { hasBrandSignals, suggestFonts } from '@/modules/font-catalog/recommend'
import { describeAvailability } from '@/modules/brand-system/availability'
import { assessRoleFit, KIND_LABEL } from '@/modules/brand-system/fit'
import { resolveRole } from '@/modules/brand-system/fonts'
import { addCatalogFont, addRole, assignCustomTypeface, assignSource, canRemoveRole, removeRole, updateRole } from '@/modules/brand-system/ops'
import { styleProps } from '@/modules/brand-system/preview'
import { sizeSpec } from '@/modules/typography-system/scale'
import { typeStyles } from '@/modules/typography-system/tokens'
import { typographyIssues } from '@/modules/typography-system/validate'
import { Button, ButtonLink, inputClass, NumberField } from '@/modules/shared-ui'
import { useProject } from '../project'
import { FitNotes, VerdictChip } from './FitNotes'
import { OriginBadge } from './OriginBadge'

const sizeText = (min: number, max: number) => (min === max ? `${max}px` : `${min}px to ${max}px`)

/** Roles: what each is for, which font it uses (existing or custom) and its type settings. */
export function RolesEditor() {
  const { draft, editor, customFont, fonts } = useProject()
  const face = draft.customTypeface
  const roles = draft.typography.roles
  const [removing, setRemoving] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<RoleKind>('caption')

  const fits = useMemo(
    () => new Map(roles.map((r) => [r.id, face ? assessRoleFit(face, r, sizeSpec(draft.typography, r.scaleStep).minPx) : null])),
    [face, roles, draft.typography],
  )
  const issues = useMemo(() => typographyIssues(draft), [draft])
  const styles = useMemo(() => new Map(typeStyles(draft).filter((s) => s.kind === 'role').map((s) => [s.id, s])), [draft])

  const choose = (roleId: string, value: string) =>
    editor.patch((p) => {
      if (value === '') return updateRole(p, roleId, { font: null })
      if (value === 'custom') return assignCustomTypeface(p, roleId)
      if (value.startsWith('source:')) return assignSource(p, roleId, value.slice(7))
      if (value.startsWith('catalog:')) {
        const added = addCatalogFont(p, value.slice(8))
        return added ? assignSource(added.project, roleId, added.sourceId) : p
      }
      return p
    })
  const applySuggested = (roleId: string, catalogId: string) => choose(roleId, `catalog:${catalogId}`)
  const inProject = new Set(draft.fontSources.map((s) => s.family.toLowerCase()))
  const bundledToAdd = CATALOG.filter((c) => !inProject.has(c.family.toLowerCase()))
  const signals = hasBrandSignals(draft.brand)

  return (
    <div className="grid min-w-0 gap-6">
      <ul aria-label="Roles" className="divide-y divide-line border-y border-line">
        {roles.map((role) => {
          const font = resolveRole(draft, role)
          const fit = fits.get(role.id) ?? null
          const spec = sizeSpec(draft.typography, role.scaleStep)
          const usesCustom = font.origin === 'custom'
          // The typeface is offered for a role only when it is appropriate; if it already is assigned, it stays selectable so the choice is visible.
          const customBlocked = fit?.verdict === 'unsuitable' && !usesCustom
          const value = !role.font ? '' : role.font.kind === 'custom' ? 'custom' : `source:${role.font.sourceId}`
          const availability = role.font?.kind === 'source' ? fonts.availability.get(role.font.sourceId) : undefined
          const source = font.source
          const roleIssues = issues.filter((i) => i.roleId === role.id)
          const suggestions = signals ? suggestFonts(draft.brand, role.kind, 3) : []
          return (
            <li key={role.id} aria-label={role.name} data-role={role.name} className="grid min-w-0 gap-4 py-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="text-base font-bold text-ink-strong">{role.name}</h3>
                <OriginBadge origin={font.origin} />
                {usesCustom && fit ? <VerdictChip verdict={fit.verdict} /> : null}
                <span className="tnum text-xs text-ink-soft">{sizeText(spec.minPx, spec.maxPx)} · {KIND_LABEL[role.kind]}</span>
              </div>

              <p
                data-testid="role-sample"
                data-role-sample={role.name}
                data-font-origin={font.origin}
                data-font-state={usesCustom ? customFont.state : 'n/a'}
                data-font-revision={usesCustom ? customFont.revision : undefined}
                className="min-w-0 overflow-hidden pb-[0.18em] text-ellipsis whitespace-nowrap text-ink-strong"
                // A tight line height (a display role's 1.05) would cut the descender of g, p and y off at the box: this sample is a specimen, so it always gets room for them.
                style={{ ...styleProps(draft, styles.get(role.id) ?? null, draft.typography.responsive.maxViewportPx), fontSize: Math.min(spec.maxPx, 72), lineHeight: 1.3 }}
              >
                Hamburgefonstiv 0123456789
              </p>

              <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] sm:items-start">
                <label className="grid min-w-0 gap-1 text-sm font-semibold text-ink-strong">
                  <span aria-hidden="true">Font</span>
                  <select aria-label={`Font of ${role.name}`} value={value} onChange={(e) => choose(role.id, e.target.value)} className={`${inputClass} w-full font-normal`}>
                    <option value="">No font assigned</option>
                    {face ? (
                      <optgroup label="Custom typeface (this project)">
                        <option value="custom" disabled={customBlocked}>{face.familyName}{customBlocked ? ' (not appropriate for this role)' : ''}</option>
                      </optgroup>
                    ) : null}
                    {draft.fontSources.length > 0 ? (
                      <optgroup label="Existing fonts in this project">
                        {draft.fontSources.map((s) => <option key={s.id} value={`source:${s.id}`}>{s.family}</option>)}
                      </optgroup>
                    ) : null}
                    {bundledToAdd.length > 0 ? (
                      <optgroup label="From the catalog (adds it to the project)">
                        {bundledToAdd.map((c) => <option key={c.id} value={`catalog:${c.id}`}>{c.family}</option>)}
                      </optgroup>
                    ) : null}
                    {font.origin === 'broken' ? <option value={value} disabled>{font.family}</option> : null}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-sm font-semibold text-ink-strong">
                  <span aria-hidden="true">Kind</span>
                  <select aria-label={`Kind of ${role.name}`} value={role.kind} onChange={(e) => editor.patch((p) => updateRole(p, role.id, { kind: e.target.value as RoleKind }))} className={`${inputClass} w-full font-normal`}>
                    {ROLE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-4">
                <NumberField label="Weight" srSuffix={` of ${role.name}`} value={role.weight} min={1} max={1000} onCommit={(v) => editor.patch((p) => updateRole(p, role.id, { weight: Math.round(v) }))} />
                <NumberField label="Scale step" srSuffix={` of ${role.name}`} value={role.scaleStep} min={-6} max={12} onCommit={(v) => editor.patch((p) => updateRole(p, role.id, { scaleStep: Math.round(v) }))} />
                <NumberField label="Line height" srSuffix={` of ${role.name}`} value={role.lineHeight} min={0.8} max={3} step={0.05} onCommit={(v) => editor.patch((p) => updateRole(p, role.id, { lineHeight: v }))} />
                <NumberField label="Tracking (em)" srSuffix={` of ${role.name}`} value={role.letterSpacingEm} min={-0.2} max={0.5} step={0.01} onCommit={(v) => editor.patch((p) => updateRole(p, role.id, { letterSpacingEm: v }))} />
              </div>

              {font.origin === 'broken' ? (
                <p className="text-sm text-danger">This role points at a font that is no longer in the project. Choose another font; until then it is drawn and exported without one.</p>
              ) : null}
              {availability && source ? (
                <p data-testid="role-availability" data-status={availability.status} className={`text-sm ${availability.status === 'loaded' || availability.status === 'installed' ? 'text-ink-soft' : availability.status === 'loading' || availability.status === 'unknown' ? 'text-ink-soft' : 'text-warn'}`}>
                  {describeAvailability(availability, source)}
                  {availability.status === 'failed' ? <Button variant="ghost" className="ml-2 !min-h-8 underline underline-offset-4" onClick={() => fonts.retry(source.id)}>Try again</Button> : null}
                </p>
              ) : null}
              {roleIssues.length > 0 ? (
                <ul aria-label={`Checks for ${role.name}`} data-testid="role-issues" className="grid gap-1 text-sm text-warn">
                  {roleIssues.map((i) => <li key={i.id}>{i.message}</li>)}
                </ul>
              ) : null}
              {customBlocked && fit ? (
                <p data-testid="custom-blocked" className="text-sm text-ink-soft">
                  Your typeface can’t be used for this role: {fit.findings.filter((f) => f.level === 'blocks').map((f) => f.message).join(' ')}
                </p>
              ) : null}
              {usesCustom && fit ? <FitNotes fit={fit} onFix={(f) => editor.patch((p) => updateRole(p, role.id, { weight: f.value }))} /> : null}

              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-ink-strong">Font suggestions for {KIND_LABEL[role.kind].toLowerCase()}</summary>
                <div className="mt-2 grid gap-2">
                  {!signals ? (
                    <p className="text-ink-soft">Set a tone or a use case in the brand direction on the overview to get suggestions.</p>
                  ) : suggestions.length === 0 ? (
                    <p className="text-ink-soft">No catalog font scores above zero for this role and brand direction.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {suggestions.map((s) => (
                        <li key={s.font.id} data-suggestion={s.font.family} className="flex flex-wrap items-start gap-x-4 gap-y-1">
                          <div className="min-w-48 flex-1">
                            <p className="tnum font-semibold text-ink-strong">{s.font.family} <span className="font-normal text-ink-soft">score {s.score}</span></p>
                            <ul className="tnum text-xs text-ink-soft">{s.reasons.map((r) => <li key={r.text}>{r.points > 0 ? '+' : ''}{r.points} {r.text}</li>)}</ul>
                          </div>
                          <Button aria-label={`Use ${s.font.family} for ${role.name}`} onClick={() => applySuggested(role.id, s.font.id)}>Use</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-ink-soft">Fixed rules over Tynovo’s own tags and the fonts’ weights, not an AI model and not a legibility test.</p>
                </div>
              </details>

              {removing === role.id ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm removing ${role.name}`}>
                  <span className="text-sm font-semibold text-danger">Remove the role “{role.name}”? Its font, size and spacing settings are lost.</span>
                  <Button variant="danger" onClick={() => { editor.patch((p) => removeRole(p, role.id)); setRemoving(null) }}>Remove role</Button>
                  <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
                </div>
              ) : canRemoveRole(draft, role.id) ? (
                <div><Button variant="ghost" aria-label={`Remove role ${role.name}`} onClick={() => setRemoving(role.id)}>Remove role…</Button></div>
              ) : (
                <p className="text-xs text-ink-soft">The only {KIND_LABEL[role.kind].toLowerCase()} role, so it stays.</p>
              )}
            </li>
          )
        })}
      </ul>

      {!face ? (
        <p className="text-sm text-ink-soft">
          Want an original typeface in one of these roles? <ButtonLink to="../typeface" variant="ghost" className="!min-h-8 underline underline-offset-4">Design one in the Custom Typeface Creator</ButtonLink>
        </p>
      ) : null}

      <form
        aria-label="New role"
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          let added = false
          editor.patch((p) => {
            const next = addRole(p, newName, newKind)
            added = next !== null
            return next ?? p
          })
          if (added) setNewName('')
        }}
      >
        <label className="grid gap-1 text-sm font-semibold text-ink-strong">
          Add a role
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="e.g. Label, Pull quote" className={`${inputClass} font-normal`} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink-strong">
          Kind
          <select aria-label="Kind of the new role" value={newKind} onChange={(e) => setNewKind(e.target.value as RoleKind)} className={`${inputClass} font-normal`}>
            {ROLE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={newName.trim() === '' || roles.length >= 30}>Add role</Button>
      </form>
    </div>
  )
}
