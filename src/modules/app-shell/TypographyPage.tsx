import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useProject } from './project'
import { BrandPreview } from './typography/BrandPreview'
import { FontsPanel } from './typography/FontsPanel'
import { PairingPanel } from './typography/PairingPanel'
import { RolesEditor } from './typography/RolesEditor'
import { ScaleEditor } from './typography/ScaleEditor'

const SECTIONS = [
  { id: 'fonts', title: 'Fonts', note: 'Your own typeface and the existing fonts this project uses: whether each really loads, its licence and its fallback stack.', Body: FontsPanel },
  { id: 'pairing', title: 'Font pairing', note: 'A primary and a secondary font, applied to roles in one step. Any role can still differ.', Body: PairingPanel },
  { id: 'roles', title: 'Roles', note: 'Choose a font for each role. Your own typeface is offered where it has the characters and the readability the role needs.', Body: RolesEditor },
] as const

export function TypographyPage() {
  const { draft } = useProject()
  const { hash } = useLocation()
  // Deep links such as /typography#roles land on their section once the page has rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, draft.id])
  return (
    <div className="grid gap-12">
      <section id="scale" aria-labelledby="scale-h" className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="scale-h" className="text-lg font-bold">Type scale</h2>
          <p className="mt-1 text-sm text-ink-soft">Each step is the base size times the ratio to the power of its step number.</p>
        </div>
        <ScaleEditor />
      </section>

      {SECTIONS.map(({ id, title, note, Body }) => (
        <section key={id} id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
          <div>
            <h2 id={`${id}-h`} className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{note}</p>
          </div>
          <Body />
        </section>
      ))}

      <section id="previews" aria-labelledby="prev-h" className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 id="prev-h" className="text-lg font-bold">Brand previews</h2>
          <p className="mt-1 text-sm text-ink-soft">The roles above, set in real layouts. They update as you change fonts, roles, sizes or the typeface itself.</p>
        </div>
        <BrandPreview />
      </section>
    </div>
  )
}
