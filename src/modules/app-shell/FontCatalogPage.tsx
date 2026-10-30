import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import type { RoleKind, Tone, UseCase } from '@/modules/brand-projects/schema'
import { PRIORITY_LABEL, TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { addCatalogFont, setPairing } from '@/modules/brand-system/ops'
import { CATALOG, CATEGORY_LABEL, catalogFontFor, type CatalogFont } from '@/modules/font-catalog/catalog'
import { fontLoader, nearestWeight, type FontSpec } from '@/modules/font-catalog/loader'
import { filterCatalog, hasBrandSignals, NO_FILTER, RECOMMENDATION_NOTE, scoreFont, type CatalogFilter } from '@/modules/font-catalog/recommend'
import { AppSeo } from '@/modules/marketing/Seo'
import { AlertIcon, Banner, Button, CheckIcon, Drawer, inputClass } from '@/modules/shared-ui'
import { CatalogToolbar } from './catalog/CatalogToolbar'
import { EditGroup } from './EditGroup'
import { useProject } from './project'

const KINDS: { kind: RoleKind; label: string }[] = [{ kind: 'display', label: 'Display' }, { kind: 'heading', label: 'Headings' }, { kind: 'body', label: 'Body text' }, { kind: 'ui', label: 'Interface' }]

/** Browse the bundled, properly licensed fonts: search, filter, see weights, styles and licence, and add them to the project. */
export function FontCatalogPage() {
  const { draft, editor, readOnly } = useProject()
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER)
  const [sort, setSort] = useState<'az' | 'match'>('az')
  const [openId, setOpenId] = useState<string | null>(null)
  const brand = draft.brand
  const signals = hasBrandSignals(brand)

  const inProject = useMemo(() => new Set(draft.fontSources.filter((s) => s.kind === 'catalog').map((s) => catalogFontFor(s.family)?.id)), [draft.fontSources])
  const matchScore = (f: CatalogFont) => Math.max(...(['display', 'heading', 'body'] as const).map((k) => scoreFont(f, brand, k).score))
  const results = useMemo(() => {
    const list = filterCatalog(filter)
    return sort === 'match' && signals ? [...list].sort((a, b) => matchScore(b) - matchScore(a) || a.family.localeCompare(b.family)) : list // eslint-disable-line
  }, [filter, sort, signals, brand.tones, brand.useCases, brand.readabilityPriority, brand.displayPriority]) // eslint-disable-line
  const open = CATALOG.find((f) => f.id === openId) ?? null

  return (
    <div className="grid gap-8">
      <AppSeo title="Font catalog" />
      <header className="grid max-w-3xl gap-2">
        <h2 className="text-xl font-extrabold">Font catalog</h2>
        <p className="text-ink">
          {CATALOG.length} fonts, all under the SIL Open Font License 1.1, which allows use and redistribution. The files ship with Tynovo and load from it only when a font is previewed or used by a role: nothing comes from a third-party server, and nothing loads until it is needed.
        </p>
        <p className="text-sm text-ink-soft">Category, weights, styles and licence come from each font’s own package. The tone and use-case tags are Tynovo’s own judgement, used only to order and filter. Need a font that is installed on your device instead? <Link to="../typography#fonts" className="font-semibold text-accent-strong underline underline-offset-4">Add it by name on the typography page</Link>.</p>
      </header>

      <CatalogToolbar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} brand={brand} signals={signals} shown={results.length} total={CATALOG.length} />

      <section aria-label="Results" className="grid gap-3">
        {results.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong bg-paper px-6 py-10 text-center">
            <h3 className="text-lg font-bold">No font matches</h3>
            <p className="mt-1 text-ink-soft">Try fewer filters or a shorter search.</p>
            <Button className="mt-4" onClick={() => setFilter(NO_FILTER)}>Clear filters</Button>
          </div>
        ) : (
          <ul aria-label="Fonts" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
            {results.map((f) => (
              <li key={f.id} data-font={f.family} data-category={f.category} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <button type="button" onClick={() => setOpenId(f.id)} data-drawer-opener aria-label={`Details of ${f.family}`} className="min-h-8 cursor-pointer text-left text-base font-bold text-ink-strong underline-offset-4 hover:text-accent-text hover:underline">{f.family}</button>
                  <p className="tnum text-xs text-ink-soft">
                    {CATEGORY_LABEL[f.category]} · {f.weights.length} weight{f.weights.length === 1 ? '' : 's'} ({f.weights.join(', ')}){f.italic ? ' · italic' : ''}
                    {sort === 'match' && signals ? ` · match ${matchScore(f) > 0 ? '+' : ''}${matchScore(f)}` : ''}
                  </p>
                </div>
                {inProject.has(f.id) ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><CheckIcon />In this project</span>
                ) : (
                  <Button aria-label={`Add to project: ${f.family}`} disabled={readOnly} title={readOnly ? 'The sample project cannot be changed' : undefined} onClick={() => editor.patch((p) => addCatalogFont(p, f.id)?.project ?? p)}>Add to project</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer open={open !== null} title={open ? `${open.family}` : 'Font'} onClose={() => setOpenId(null)}>
        {open ? <FontDetail key={open.id} font={open} /> : null}
      </Drawer>
    </div>
  )
}

function FontDetail({ font }: { font: CatalogFont }) {
  const { draft, editor } = useProject()
  const [weight, setWeight] = useState(nearestWeight(font.weights, 400))
  const [italic, setItalic] = useState(false)
  const [text, setText] = useState('Hamburgefonstiv 0123456789')
  useSyncExternalStore(fontLoader.subscribe, fontLoader.snapshot)
  const spec: FontSpec = { id: font.id, weight: italic ? 400 : weight, style: italic ? 'italic' : 'normal' }
  useEffect(() => {
    void fontLoader.load(spec)
  }, [spec.id, spec.weight, spec.style]) // eslint-disable-line
  const state = fontLoader.state(spec)
  const sourceId = draft.fontSources.find((s) => s.kind === 'catalog' && s.family === font.family)?.id
  const brand = draft.brand
  const signals = hasBrandSignals(brand)
  const textId = useId()

  const addAnd = (then?: (p: typeof draft, id: string) => typeof draft) =>
    editor.patch((p) => {
      const r = addCatalogFont(p, font.id)
      if (!r) return p
      return then ? then(r.project, r.sourceId) : r.project
    })

  return (
    <div className="grid gap-6" data-testid="font-detail" data-font={font.family}>
      <p className="text-sm text-ink-soft">{CATEGORY_LABEL[font.category]} · {font.tags.note}</p>

      <section aria-label="Preview" className="grid gap-3">
        <div className="grid gap-1">
          <label htmlFor={textId} className="text-sm font-semibold text-ink-strong">Sample text</label>
          <input id={textId} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} className={inputClass} />
        </div>
        <p
          data-testid="font-sample"
          data-state={state}
          data-weight={spec.weight}
          aria-label={`Sample in ${font.family} ${spec.weight}${italic ? ' italic' : ''}`}
          className={`min-h-[3.5rem] overflow-hidden rounded-md border border-line bg-sheet px-4 py-3 text-3xl break-words text-ink-strong ${state === 'loaded' ? '' : 'opacity-50'}`}
          style={state === 'loaded' ? { fontFamily: `"${font.family}", ${font.fallback}`, fontWeight: spec.weight, fontStyle: spec.style } : { fontFamily: font.fallback }}
        >
          {text || ' '}
        </p>
        {state === 'loading' || state === 'idle' ? <p role="status" className="text-xs text-ink-soft">Loading {font.family} {spec.weight} from Tynovo…</p> : null}
        {state === 'failed' ? (
          <Banner tone="error" actions={<Button onClick={() => void fontLoader.retry(spec)}>Try again</Button>}>
            <span className="inline-flex items-center gap-1.5 font-semibold"><AlertIcon />The font file could not be loaded.</span> {fontLoader.error(spec)} The sample shows a stand-in ({font.fallback}), not {font.family}.
          </Banner>
        ) : null}
      </section>

      <section aria-label="Styles and weights" className="grid gap-2">
        <h3 className="text-sm font-bold text-ink-strong">Styles and weights</h3>
        <div role="group" aria-label="Weights" className="flex flex-wrap gap-2">
          {font.weights.map((w) => (
            <button key={w} type="button" aria-pressed={!italic && weight === w} onClick={() => { setItalic(false); setWeight(w) }} className="tnum min-h-11 cursor-pointer rounded-md border border-line-strong px-3 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white md:min-h-9">{w}</button>
          ))}
          {font.italic ? <button type="button" aria-pressed={italic} onClick={() => setItalic(true)} className="min-h-11 cursor-pointer rounded-md border border-line-strong px-3 text-sm font-semibold italic aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white md:min-h-9">400 italic</button> : null}
        </div>
        <p className="text-xs text-ink-soft">
          The family has {font.styles.includes('italic') ? 'normal and italic styles' : 'a normal style only'}. Tynovo bundles the Latin subset of {font.weights.length} upright weight{font.weights.length === 1 ? '' : 's'}{font.italic ? ' and the regular italic' : ''}. Other weights, styles and scripts are not available here.
        </p>
      </section>

      <section aria-label="Source and licence" className="grid gap-2">
        <h3 className="text-sm font-bold text-ink-strong">Source and licence</h3>
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-ink-soft">Licence</dt><dd><a href={font.license.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-strong underline underline-offset-4">SIL Open Font License 1.1 ({font.license.spdx})</a></dd>
          <dt className="text-ink-soft">Copyright</dt><dd className="break-words">{font.license.copyright}</dd>
          <dt className="text-ink-soft">Version</dt><dd className="tnum">{font.version} (as reported by the package)</dd>
          <dt className="text-ink-soft">Published at</dt><dd className="break-all"><a href={font.upstream} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline underline-offset-4">{font.upstream}</a></dd>
          <dt className="text-ink-soft">Package</dt><dd className="break-all"><a href={font.page} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline underline-offset-4">{font.distribution}</a> <span className="tnum text-ink-soft">{font.distributionVersion}</span></dd>
        </dl>
        <p className="text-xs text-ink-soft">The licence is read from the package’s metadata, not from a legal review. Exports name this font but do not include its files; only the PDF specimen embeds the fonts it draws.</p>
      </section>

      <section aria-label="How it is loaded" className="grid gap-1 text-sm">
        <h3 className="text-sm font-bold text-ink-strong">Availability</h3>
        <p data-testid="font-availability" className="text-ink">
          {state === 'loaded' ? `The ${spec.weight}${italic ? ' italic' : ''} file is loaded from Tynovo.` : state === 'failed' ? 'Not available: the file could not be loaded.' : 'Not loaded yet. It loads from Tynovo when previewed or used, not from a third party.'}
        </p>
      </section>

      <section aria-label="Studio tags" className="grid gap-1 text-sm">
        <h3 className="text-sm font-bold text-ink-strong">Studio tags (our judgement, not font metadata)</h3>
        <p>Tone: {font.tags.tones.map((t: Tone) => TONE_LABEL[t]).join(', ')}. Use: {font.tags.uses.map((u: UseCase) => USE_CASE_LABEL[u]).join(', ')}. {font.tags.text ? 'Drawn for text sizes.' : 'Not tagged for long text.'} {font.tags.display ? 'Tagged for large sizes.' : ''}</p>
      </section>

      <section aria-label="Fit for your brand" className="grid gap-2 text-sm">
        <h3 className="text-sm font-bold text-ink-strong">For your brand</h3>
        {signals ? (
          <ul className="grid gap-3">
            {KINDS.map(({ kind, label }) => {
              const s = scoreFont(font, brand, kind)
              return (
                <li key={kind} data-kind={kind}>
                  <p className="tnum font-semibold text-ink-strong">{label}: {s.score > 0 ? '+' : ''}{s.score}</p>
                  {s.reasons.length === 0 ? <p className="text-ink-soft">No rule applies.</p> : <ul className="grid gap-0.5 text-ink-soft">{s.reasons.map((r) => <li key={r.text} className="tnum">{r.points > 0 ? '+' : ''}{r.points} {r.text}</li>)}</ul>}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-ink-soft">Set a tone or a use case on the <Link to=".." className="font-semibold text-accent-strong underline underline-offset-4">overview</Link> to see how this font scores. Readability is {(PRIORITY_LABEL[brand.readabilityPriority] ?? '').toLowerCase()} and display use is {(PRIORITY_LABEL[brand.displayPriority] ?? '').toLowerCase()} priority.</p>
        )}
        <p className="text-xs text-ink-soft">{RECOMMENDATION_NOTE}</p>
      </section>

      <EditGroup className="border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">
        {sourceId ? (
          <span className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ok"><CheckIcon />In this project</span>
        ) : (
          <Button variant="primary" onClick={() => addAnd()}>Add to project</Button>
        )}
        <Button onClick={() => addAnd((p, id) => setPairing(p, 'primary', { kind: 'source', sourceId: id }))}>Use as primary font</Button>
        <Button onClick={() => addAnd((p, id) => setPairing(p, 'secondary', { kind: 'source', sourceId: id }))}>Use as secondary font</Button>
      </div>
      </EditGroup>
      <p className="text-xs text-ink-soft">Primary and secondary set the project’s pairing. Apply it to roles on the <Link to="../typography#pairing" className="font-semibold text-accent-strong underline underline-offset-4">typography page</Link>.</p>
    </div>
  )
}
