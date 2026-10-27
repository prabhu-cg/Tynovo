import { useEffect, useId, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { Link } from 'react-router'
import type { Brand, Tone, UseCase } from '@/modules/brand-projects/schema'
import { TONES, USE_CASES } from '@/modules/brand-projects/schema'
import { TONE_LABEL, USE_CASE_LABEL } from '@/modules/brand-system/brand'
import { CATEGORIES, CATEGORY_LABEL, type FontCategory } from '@/modules/font-catalog/catalog'
import { NO_FILTER, type CatalogFilter } from '@/modules/font-catalog/recommend'
import { ActionMenu, Button, Chip, CloseIcon, inputClass, SearchIcon, SlidersIcon, SortIcon } from '@/modules/shared-ui'

export type CatalogSort = 'az' | 'match'
const SORT_LABEL: Record<CatalogSort, string> = { az: 'A to Z', match: 'Best match for my brand' }
const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/** How many filters are applied (the search text is shown in the field itself, so it is not counted). */
const activeFilterCount = (f: CatalogFilter) => f.categories.length + f.tones.length + f.uses.length + (f.text ? 1 : 0) + (f.display ? 1 : 0)

/**
 * The catalog's search and filters as one compact row, as on ReqStudio: the result count, a search field, a Filter button
 * that opens a single panel, and a Sort menu. Applied filters stay visible below the row as chips that can be removed
 * one by one or all at once, so nothing is hidden when the panel is closed.
 */
export function CatalogToolbar({ filter, setFilter, sort, setSort, brand, signals, shown, total }: {
  filter: CatalogFilter
  setFilter: Dispatch<SetStateAction<CatalogFilter>>
  sort: CatalogSort
  setSort: (s: CatalogSort) => void
  brand: Brand
  signals: boolean
  shown: number
  total: number
}) {
  const row = useRef<HTMLDivElement>(null)
  const count = activeFilterCount(filter)
  const active = filter.query !== '' || count > 0
  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...(filter.query !== '' ? [{ key: 'q', label: `“${filter.query}”`, remove: () => setFilter((f) => ({ ...f, query: '' })) }] : []),
    ...filter.categories.map((c) => ({ key: `c:${c}`, label: CATEGORY_LABEL[c], remove: () => setFilter((f) => ({ ...f, categories: toggle(f.categories, c) })) })),
    ...filter.tones.map((t) => ({ key: `t:${t}`, label: TONE_LABEL[t as Tone], remove: () => setFilter((f) => ({ ...f, tones: toggle(f.tones, t) })) })),
    ...filter.uses.map((u) => ({ key: `u:${u}`, label: USE_CASE_LABEL[u as UseCase], remove: () => setFilter((f) => ({ ...f, uses: toggle(f.uses, u) })) })),
    ...(filter.text ? [{ key: 'text', label: 'Drawn for text', remove: () => setFilter((f) => ({ ...f, text: false })) }] : []),
    ...(filter.display ? [{ key: 'display', label: 'Suited to large sizes', remove: () => setFilter((f) => ({ ...f, display: false })) }] : []),
  ]
  return (
    <section aria-label="Search and filters" className="grid gap-2">
      <div ref={row} className="flex flex-wrap items-center gap-2">
        <p role="status" data-testid="catalog-count" className="tnum mr-auto text-sm text-ink-soft">{shown} of {total} fonts{active ? ' match' : ''}.</p>
        <div className="relative order-last w-full sm:order-none sm:w-64">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
          <input type="search" aria-label="Search by family name" value={filter.query} onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} placeholder="Search fonts" className={`${inputClass} w-full pl-9`} />
        </div>
        <FilterPanel anchor={row} filter={filter} setFilter={setFilter} count={count} brand={brand} signals={signals} />
        <ActionMenu
          label={`Sort: ${SORT_LABEL[sort]}`}
          icon={<SortIcon />}
          text={sort === 'az' ? 'A to Z' : 'Best match'}
          items={(Object.keys(SORT_LABEL) as CatalogSort[]).map((s) => ({ id: s, label: SORT_LABEL[s], checked: sort === s, onSelect: () => setSort(s) }))}
        />
      </div>

      {sort === 'match' && !signals ? (
        <p className="text-sm text-ink-soft">Ordering by match needs a tone or a use case. <Link to=".." className="font-semibold text-accent-strong underline underline-offset-4">Set them on the overview</Link>.</p>
      ) : null}

      {chips.length > 0 ? (
        <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <li key={c.key} className="inline-flex items-center gap-1 rounded-full bg-accent-wash py-0.5 pr-1 pl-3 text-xs font-semibold text-accent-strong">
              {c.label}
              <button type="button" onClick={c.remove} aria-label={`Remove ${c.label} filter`} className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent/15"><CloseIcon width={12} height={12} /></button>
            </li>
          ))}
          <li><Button variant="ghost" onClick={() => setFilter(NO_FILTER)} className="min-h-9 px-2.5 text-xs md:min-h-8">Clear filters</Button></li>
        </ul>
      ) : null}
    </section>
  )
}

function FilterPanel({ anchor, filter, setFilter, count, brand, signals }: { anchor: RefObject<HTMLElement | null>; filter: CatalogFilter; setFilter: Dispatch<SetStateAction<CatalogFilter>>; count: number; brand: Brand; signals: boolean }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  // The panel is fixed to the viewport, not absolutely positioned: an absolute panel that runs past the bottom of a short page
  // makes the page taller while it is open, and closing it shrinks the page and jolts everything. Placement: a bottom sheet on a
  // phone; otherwise under the toolbar row, or above it when there is more room there.
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const place = () => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    if (window.innerWidth < 640) return setPos({ left: 8, right: 8, bottom: 8, maxHeight: Math.round(window.innerHeight * 0.75) })
    const below = window.innerHeight - r.bottom - 22
    const above = r.top - 22
    const base = { right: document.documentElement.clientWidth - r.right, width: Math.min(576, r.width) }
    setPos(below >= 300 || below >= above ? { ...base, top: r.bottom + 6, maxHeight: Math.max(160, below) } : { ...base, bottom: window.innerHeight - r.top + 6, maxHeight: Math.max(160, above) })
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(place) // measured again once the layout has settled after the click
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }) // re-subscribed after each render while open, so the handler is never stale

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div ref={root} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { if (!open) place(); setOpen((o) => !o) }}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm font-semibold text-ink-strong transition-colors hover:border-ink hover:bg-sheet aria-expanded:bg-sheet md:min-h-9"
      >
        <SlidersIcon />
        Filter
        {count > 0 ? <span aria-label={`${count} applied`} className="tnum grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{count}</span> : null}
      </button>
      {open && pos ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Filter fonts"
          tabIndex={-1}
          data-fade
          style={pos}
          className="popover-panel fixed z-30 flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-lift outline-none"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-bold">Filter fonts</h3>
            {count > 0 ? <Button variant="ghost" onClick={() => setFilter((f) => ({ ...NO_FILTER, query: f.query }))} className="min-h-9 px-2.5 text-xs md:min-h-8"><CloseIcon width={14} height={14} />Clear {count}</Button> : null}
          </div>
          <div className="grid gap-x-8 gap-y-5 overflow-y-auto p-4 sm:grid-cols-2">
            <Group label="Category">
              {CATEGORIES.map((c) => <Chip key={c} checked={filter.categories.includes(c)} onChange={() => setFilter((f) => ({ ...f, categories: toggle(f.categories, c as FontCategory) }))}>{CATEGORY_LABEL[c]}</Chip>)}
            </Group>
            <Group label="Tone (studio tags)">
              {TONES.map((t) => <Chip key={t} checked={filter.tones.includes(t)} onChange={() => setFilter((f) => ({ ...f, tones: toggle(f.tones, t) }))}>{TONE_LABEL[t]}</Chip>)}
            </Group>
            <Group label="Use (studio tags)" wide>
              {USE_CASES.map((u) => <Chip key={u} checked={filter.uses.includes(u)} onChange={() => setFilter((f) => ({ ...f, uses: toggle(f.uses, u) }))}>{USE_CASE_LABEL[u]}</Chip>)}
              <Chip checked={filter.text} onChange={() => setFilter((f) => ({ ...f, text: !f.text }))}>Drawn for text</Chip>
              <Chip checked={filter.display} onChange={() => setFilter((f) => ({ ...f, display: !f.display }))}>Suited to large sizes</Chip>
            </Group>
          </div>
          {signals ? (
            <div className="border-t border-line bg-sheet px-4 py-2.5">
              <Button onClick={() => setFilter((f) => ({ ...f, tones: [...brand.tones], uses: [...brand.useCases] }))}>Use my brand’s tone and use cases</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Group({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <fieldset className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <legend className="mb-2 text-xs font-bold tracking-[0.08em] text-ink-soft uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}
