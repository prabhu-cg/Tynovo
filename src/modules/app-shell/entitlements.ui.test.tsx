import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { DEFAULT_CONFIG, defaultGrant, type EntitlementConfig, type Grant } from '@/modules/entitlements'
import { createProject } from '@/modules/brand-projects/model'
import type { Project } from '@/modules/brand-projects/schema'
import { ProjectService } from '@/modules/brand-projects/service'
import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import { fakeClock } from '@/modules/testing/factories'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { EntitlementsProvider } from './EntitlementsProvider'
import { GlyphToolbar } from './typeface/GlyphToolbar'
import { CreateTypeface } from './typeface/CreateTypeface'
import { DnaPanel } from './typeface/DnaPanel'
import { VariantsTab } from './typeface/VariantsTab'
import type { TypefaceHandle } from './typeface/useTypeface'
import { SettingsPage } from './SettingsPage'
import { StudioCtx } from './studio'
import type { ProjectContext } from './project'

/** A configuration that really restricts things (data only), and a trusted grant for each tier, as a server would give. */
function config(over: Record<string, boolean | number> = {}): EntitlementConfig {
  const c = structuredClone(DEFAULT_CONFIG)
  for (const id of ['typeface.family.rounded', 'typeface.family.modular', 'typeface.variants.explore', 'glyph.edit.structure', 'glyph.edit.shape-params', 'quality.extended', 'export.font.otf', 'export.specimen', 'export.package']) c.tiers['free']!.grants[id] = false
  c.tiers['free']!.grants['typeface.variants.maxSaved'] = 2
  Object.assign(c.tiers['free']!.grants, over)
  return c
}
const FREE = defaultGrant('free')

function withProject(ui: ReactElement, { cfg = config(), grant = FREE, project = createProject('P', fakeClock()) }: { cfg?: EntitlementConfig; grant?: Grant; project?: Project } = {}) {
  const patch = vi.fn()
  const ctx = { draft: project, editor: { patch } } as unknown as ProjectContext
  render(
    <EntitlementsProvider config={cfg} grant={grant}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={ctx} />}>
            <Route index element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>
    </EntitlementsProvider>,
  )
  return { patch, project }
}

describe('typeface families follow the plan', () => {
  it('shows an excluded family locked, with the reason, and cannot start one from it', async () => {
    const { patch } = withProject(<CreateTypeface />)
    const rounded = screen.getByRole('button', { name: /Start with Rounded/ })
    expect(rounded).toBeDisabled()
    expect(screen.getAllByTestId('locked')).toHaveLength(2)
    expect(screen.getAllByTestId('locked')[0]).toHaveTextContent('is not included in the Free plan. Paid plans are not available yet.')
    expect(screen.getByRole('button', { name: /Start with Geometric/ })).toBeEnabled()
    await userEvent.click(rounded)
    expect(patch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Start with Geometric/ }))
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('offers every family when the plan includes them', () => {
    withProject(<CreateTypeface />, { cfg: DEFAULT_CONFIG })
    for (const n of ['Geometric', 'Rounded', 'Modular']) expect(screen.getByRole('button', { name: new RegExp(`Start with ${n}`) })).toBeEnabled()
    expect(screen.queryByTestId('locked')).toBeNull()
  })

  it('a trusted grant for a richer tier unlocks them; an untrusted claim for it does not', () => {
    const c = config()
    c.tiers['paid'] = { label: 'Plus', extends: 'free', grants: { 'typeface.family.rounded': true, 'typeface.family.modular': true } }
    const { unmount } = render(<span />)
    unmount()
    withProject(<CreateTypeface />, { cfg: c, grant: { tier: 'paid', trusted: true, source: 'server', preview: false } })
    expect(screen.getByRole('button', { name: /Start with Rounded/ })).toBeEnabled()
  })

  it('an untrusted claim for the richer tier changes nothing', () => {
    const c = config()
    c.tiers['paid'] = { label: 'Plus', extends: 'free', grants: { 'typeface.family.rounded': true } }
    withProject(<CreateTypeface />, { cfg: c, grant: { tier: 'paid', trusted: false, source: 'local-default', preview: false } })
    expect(screen.getByRole('button', { name: /Start with Rounded/ })).toBeDisabled()
  })

  it('hiding is a presentation choice: the family switch lists only allowed families but never hides the one in use', () => {
    const rounded = { ...createTypeface('t', 'rounded') }
    const handle: TypefaceHandle = { face: rounded, update: vi.fn(), edit: vi.fn() }
    const project = { ...createProject('P', fakeClock()), customTypeface: rounded }
    withProject(<DnaPanel handle={handle} />, { project })
    const family = within(screen.getByRole('group', { name: 'Family' }))
    expect(family.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['geometric', 'rounded']) // modular is locked, rounded is in use
    expect(screen.getByTestId('locked')).toHaveTextContent(/Not included in the Free plan: Modular/)
  })
})

describe('variants follow the plan, and never lose what is saved', () => {
  const face = (n: number) => {
    let f = createTypeface('t')
    const dna = f.dna
    for (let i = 0; i < n; i++) f = { ...f, variants: [{ id: `v${i}`, name: `Saved ${i}`, dna, favourite: false, origin: null, createdAt: '2026-01-01T00:00:00.000Z' }, ...f.variants] }
    return f
  }
  const handleFor = (f: ReturnType<typeof face>): TypefaceHandle => ({ face: f, update: vi.fn(), edit: vi.fn() })

  it('exploring can be left out of a plan; variants already saved stay visible and usable', () => {
    withProject(<VariantsTab handle={handleFor(face(1))} />)
    expect(screen.getByTestId('locked')).toHaveTextContent('Explore design variations is not included')
    expect(screen.queryByRole('button', { name: 'Next seed' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Saved variants' })).toHaveTextContent('Saved 0')
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Delete Saved 0/ })).toBeEnabled()
  })

  it('at the limit saving is disabled with the reason, and nothing is removed', () => {
    const f = face(2)
    const h = handleFor(f)
    withProject(<VariantsTab handle={h} />, { cfg: config({ 'typeface.variants.explore': true }) })
    expect(screen.getByTestId('variant-count')).toHaveTextContent('2 of 2 saved. You are at the limit of the Free plan: delete a variant to save another. Nothing you have saved is removed. Paid plans are not available yet.')
    for (const b of screen.getAllByRole('button', { name: 'Save' })) expect(b).toBeDisabled()
    expect(h.update).not.toHaveBeenCalled()
  })

  it('below the limit saving works and passes the limit to the domain', async () => {
    const h = handleFor(face(1))
    withProject(<VariantsTab handle={h} />, { cfg: config({ 'typeface.variants.explore': true }) })
    expect(screen.getByTestId('variant-count')).toHaveTextContent('1 of 2 saved.')
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!)
    expect(h.update).toHaveBeenCalledTimes(1)
  })

  it('a project over a lowered limit keeps everything and says so', () => {
    withProject(<VariantsTab handle={handleFor(face(4))} />, { cfg: config({ 'typeface.variants.explore': true }) })
    expect(screen.getByTestId('variant-count')).toHaveTextContent('4 of 2 saved. You are at the limit of the Free plan and over it')
    expect(screen.getByRole('list', { name: 'Saved variants' }).querySelectorAll('li')).toHaveLength(4)
  })
})

describe('glyph editing controls follow the plan', () => {
  const toolbarProps = { tool: 'select' as const, onTool: vi.fn(), canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(), canInsert: false, canDelete: false, onInsert: vi.fn(), onDelete: vi.fn(), canCurve: false, canStraighten: false, canSmooth: false, canFitCurves: false, onFitCurves: vi.fn(), onCurve: vi.fn(), onStraighten: vi.fn(), onSmooth: vi.fn(), zoom: 100, onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn(), onFit2: vi.fn(), snap: 0, onSnap: vi.fn(), guides: false, onGuides: vi.fn(), ghost: false, ghostAvailable: false, onGhost: vi.fn() }

  it('the point tools are disabled with the reason as their hint, and can be hidden instead', () => {
    const note = 'Add and delete outline points is not included in the Free plan. Paid plans are not available yet.'
    const { unmount } = render(<GlyphToolbar {...toolbarProps} canInsert canDelete structureNote={note} />)
    const insert = screen.getByRole('button', { name: 'Insert a point after the selected point' })
    expect(insert).toBeDisabled() // the plan decides, even when the selection would allow it
    expect(insert).toHaveAttribute('title', note)
    unmount()
    render(<GlyphToolbar {...toolbarProps} structureNote={note} structureHidden />)
    expect(screen.queryByRole('button', { name: /Insert a point/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Select and move points' })).toBeEnabled() // basic editing is never affected
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined()
  })

  it('the curve tools follow their own feature: disabled with the reason, hidden on request, never touching basic editing', () => {
    const note = 'Curve editing is not included in the Free plan. Paid plans are not available yet.'
    const { unmount } = render(<GlyphToolbar {...toolbarProps} canCurve canStraighten canSmooth curvesNote={note} />)
    const curve = screen.getByRole('button', { name: /Turn the segment after the selected point into a curve/ })
    expect(curve).toBeDisabled()
    expect(curve).toHaveAttribute('title', note)
    unmount()
    render(<GlyphToolbar {...toolbarProps} canCurve curvesNote={note} curvesHidden />)
    expect(screen.queryByRole('button', { name: /into a curve/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Select and move points' })).toBeEnabled()
  })

  it('the curve tools are enabled when the plan allows them and the selection gives them something to do', () => {
    render(<GlyphToolbar {...toolbarProps} canCurve canSmooth />)
    expect(screen.getByRole('button', { name: /into a curve/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /straight line/ })).toBeDisabled() // nothing to straighten
    expect(screen.getByRole('button', { name: /Smooth the selected point/ })).toBeEnabled()
  })
})

describe('the glyph editor as a whole', () => {
  // The editor needs the project context and a real typeface; the browser APIs it uses are guarded for jsdom.
  const renderEditor = async (cfg: EntitlementConfig) => {
    const { GlyphWorkspace } = await import('./typeface/GlyphWorkspace')
    const face = createTypeface('t', 'geometric')
    const handle: TypefaceHandle = { face, update: vi.fn(), edit: vi.fn() }
    const project = { ...createProject('P', fakeClock()), customTypeface: face }
    const setGuard = vi.fn()
    const patch = vi.fn()
    const ctx = { draft: project, editor: { patch }, setGuard } as unknown as ProjectContext
    render(
      <EntitlementsProvider config={cfg} grant={FREE}>
        <MemoryRouter>
          <Routes>
            <Route element={<Outlet context={ctx} />}>
              <Route index element={<GlyphWorkspace handle={handle} char="H" onNavigate={() => undefined} />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </EntitlementsProvider>,
    )
    return { handle }
  }

  it('basic editing stays, structure and shape controls are locked with the reason, and every route to them is closed', async () => {
    const { handle } = await renderEditor(config())
    const insert = screen.getAllByRole('button', { name: /Insert a point after the selected point/ })[0]!
    expect(insert).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select and move points' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Reset to generated shape/ })).toBeDefined()
    const notes = screen.getAllByTestId('locked').map((n) => n.textContent)
    expect(notes.join('\n')).toMatch(/Add and delete outline points is not included in the Free plan\. Paid plans are not available yet\./)
    expect(notes.join('\n')).toMatch(/Per-glyph shape settings is not included in the Free plan/)
    // No stroke/width/roundness/corner sliders while shape settings are locked.
    expect(screen.queryByRole('slider', { name: 'Stroke thickness' })).toBeNull()
    // The keyboard is another way in: it is closed too.
    const canvas = screen.getByRole('application', { name: 'Outline of H' })
    const mentions = () => screen.getAllByText(/Add and delete outline points is not included/).length
    const before = mentions()
    canvas.focus()
    await userEvent.keyboard('{BracketRight}i')
    expect(mentions()).toBeGreaterThan(before) // the editor answers the key with the reason instead of acting
    expect(screen.queryByText('Point inserted and selected.')).toBeNull()
    expect(handle.update).not.toHaveBeenCalled()
  })

  it('with the plan\'s features included, shape settings are there', async () => {
    await renderEditor(DEFAULT_CONFIG)
    expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('locked')).toBeNull()
    // The same keys that were refused above work when the plan includes them, so the refusal is the plan's doing.
    screen.getByRole('application', { name: 'Outline of H' }).focus()
    await userEvent.keyboard(']i')
    expect(await screen.findByText('Point inserted and selected.')).toBeDefined()
  })
})

describe('the settings page tells the truth about plans', () => {
  const renderSettings = (cfg: EntitlementConfig) => {
    const service = new ProjectService(new MemoryProjectRepository(), fakeClock())
    render(
      <StudioCtx.Provider value={{ service, storageKind: 'indexeddb', storageWarning: null }}>
        <EntitlementsProvider config={cfg} grant={FREE}>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </EntitlementsProvider>
      </StudioCtx.Provider>,
    )
  }

  it('says there is no payment system and no account, and that data features are always free', () => {
    renderSettings(DEFAULT_CONFIG)
    const text = screen.getByTestId('plan').textContent ?? ''
    expect(text).toContain('Free. Everything in this version of Tynovo is included.')
    expect(text).toContain('There is no payment system in Tynovo: nothing here can be bought')
    expect(screen.getByText(/Keeping, exporting, importing, upgrading and recovering your own projects/)).toBeDefined()
    expect(screen.getByText(/There is no sign-in/)).toBeDefined()
  })

  it('lists what the plan covers, with limits as numbers, and marks what is left out', () => {
    renderSettings(config())
    const list = screen.getByRole('list', { name: 'Features', hidden: true })
    const row = (id: string) => list.querySelector(`[data-feature="${id}"]`) as HTMLElement
    expect(row('typeface.family.rounded').dataset['allowed']).toBe('false')
    expect(row('typeface.family.rounded')).toHaveTextContent('Not included')
    expect(row('typeface.family.geometric')).toHaveTextContent('Included')
    expect(row('typeface.variants.maxSaved')).toHaveTextContent('Up to 2')
    expect(screen.getByTestId('plan').textContent).toContain('Some features are not included')
  })

  it('has no purchase, upgrade, price or sign-in control', () => {
    renderSettings(config())
    for (const el of [...screen.queryAllByRole('button', { hidden: true }), ...screen.queryAllByRole('link', { hidden: true })]) {
      expect(el.textContent ?? '').not.toMatch(/buy|purchase|checkout|subscribe|upgrade|sign in|log in|pricing|price|trial|\$/i)
    }
    expect(document.body.textContent).not.toMatch(/[$€£]\d/)
  })
})
