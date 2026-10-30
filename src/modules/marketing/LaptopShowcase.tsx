import { useRef, useState, type KeyboardEvent } from 'react'

/** Real screenshots of the running app (scripts/make-screens.ts), shown in a laptop. Alt text says what is on screen. */
const SCREENS = [
  {
    id: 'overview',
    tab: 'Overview',
    file: '/screens/overview.jpg',
    caption: 'The whole workflow on one page, with a numbered step bar that stays in view on every screen: brand direction, fonts, roles, scale, typeface, preview, checks and export, each with its state.',
    alt: 'The Overview screen of the Fieldnote sample project in Tynovo. A banner says the project is a read-only sample, and below it the brand workflow lists brand direction, fonts, roles, scale, typeface and preview as done, validate as needing attention and export still to do.',
  },
  {
    id: 'catalog',
    tab: 'Font catalog',
    file: '/screens/catalog.jpg',
    caption: 'A licensed font catalog you can search and filter. Each font shows its weights, source and licence before you add it.',
    alt: 'The Font catalog screen with search and category filters, and a side panel open for Fraunces showing a sample line, its weights, the SIL Open Font License, copyright and source.',
  },
  {
    id: 'typography',
    tab: 'Typography system',
    file: '/screens/typography.jpg',
    caption: 'The system applied in a real layout. Sizes, fonts and spacing here are the ones the exported CSS uses.',
    alt: 'Brand previews in Tynovo: a website for Fieldnote with a serif heading, a humanist sans paragraph and a large headline set in the project’s own rounded typeface, with controls for context, light or dark surface and width.',
  },
  {
    id: 'typeface',
    tab: 'Typeface creator',
    file: '/screens/typeface.jpg',
    caption: 'Design an original typeface from parameters, and see the text drawn by the browser from the real font file it would export.',
    alt: 'The Custom Typeface Creator. Design parameter sliders for proportions and strokes sit on the left, and on the right a panel shows the text Hamburgefonstiv drawn in the browser from the exported TrueType file.',
  },
] as const

/**
 * A laptop drawn in CSS around a screenshot: aluminium rim, black bezel, camera notch, hinge and base with a thumb
 * groove, and a soft shadow. The shape scales with the width (everything is a percentage or an em of it), and the
 * screen keeps a 16:10 ratio so the image never crops or stretches.
 */
export function Laptop({ src, alt, width = 1920, height = 1200 }: { src: string; alt: string; width?: number; height?: number }) {
  return (
    <div data-testid="laptop" className="mx-auto w-full max-w-[60rem] px-[5%] [container-type:inline-size]">
      {/* Lid: an aluminium edge around a black bezel around the screen. */}
      <div className="rounded-[2.4cqw] bg-gradient-to-b from-[#e3e4e7] via-[#a4a5aa] to-[#6e6f74] p-[0.28cqw] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
        <div className="rounded-[2.2cqw] bg-[#060607] p-[1.9cqw] pb-[2.2cqw] shadow-[inset_0_0_0_0.2cqw_#1a1a1d]">
          <div data-testid="laptop-screen" className="relative aspect-[16/10] overflow-hidden rounded-[0.7cqw] bg-white ring-1 ring-black">
            <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="block h-full w-full object-cover object-top" />
            {/* Camera notch, with a faint lens. */}
            <div aria-hidden="true" className="absolute top-0 left-1/2 grid h-[2.6%] w-[9%] -translate-x-1/2 place-items-center rounded-b-[0.7cqw] bg-[#060607]">
              <span className="size-[0.55cqw] rounded-full bg-[#10131a] ring-[0.12cqw] ring-[#1d2230]" />
            </div>
            {/* Glass: a faint diagonal sheen, nothing more. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.03)_32%,rgba(255,255,255,0)_46%)]" />
          </div>
        </div>
      </div>
      {/* Hinge and base: slightly wider than the lid, with the thumb groove at the front. */}
      <div aria-hidden="true" className="relative -mx-[5.5%] h-[1.7cqw] rounded-b-[2.2cqw] rounded-t-[0.3cqw] bg-gradient-to-b from-[#c4c5c9] via-[#dfe0e3] to-[#aeafb4] shadow-[0_0.1cqw_0_rgba(0,0,0,0.35)_inset,0_2.6cqw_3.2cqw_-1.2cqw_rgba(0,0,0,0.38)]">
        <div className="absolute top-0 left-1/2 h-[0.75cqw] w-[15%] -translate-x-1/2 rounded-b-[0.9cqw] bg-gradient-to-b from-[#9d9ea3] to-[#c3c4c8]" />
      </div>
    </div>
  )
}

/** Tabs for the screens: the laptop's content changes, the laptop stays. Arrow keys move between tabs. */
export function LaptopShowcase() {
  const [active, setActive] = useState(0)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const screen = SCREENS[active]!

  const move = (e: KeyboardEvent, i: number) => {
    const last = SCREENS.length - 1
    const next = e.key === 'ArrowRight' ? (i + 1) % SCREENS.length : e.key === 'ArrowLeft' ? (i + last) % SCREENS.length : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <div role="tabpanel" id="screens-panel" aria-labelledby={`screen-tab-${screen.id}`} tabIndex={0} className="outline-offset-8">
        <Laptop key={screen.id} src={screen.file} alt={screen.alt} />
      </div>
      <p data-testid="screen-caption" aria-live="polite" className="mx-auto mt-8 max-w-2xl text-center text-lg">{screen.caption}</p>
      <div role="tablist" aria-label="Screens of the app" className="mt-6 flex flex-wrap justify-center gap-2">
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`screen-tab-${s.id}`}
            aria-selected={i === active}
            aria-controls="screens-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => move(e, i)}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-strong bg-paper px-4 text-sm font-semibold text-ink-strong transition-colors hover:border-ink aria-selected:border-accent aria-selected:bg-accent aria-selected:text-white md:min-h-10"
          >
            {s.tab}
          </button>
        ))}
      </div>
    </div>
  )
}
