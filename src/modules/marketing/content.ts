/**
 * Single source of truth for what the product can do. Every marketing claim reads from here, so a
 * capability cannot be described as available on one page and planned on another.
 */
export type Status = 'available' | 'early' | 'planned'

export const STATUS_LABEL: Record<Status, string> = {
  available: 'Available now',
  early: 'Early version',
  planned: 'In development',
}

export interface Capability {
  id: string
  mode: 'system' | 'typeface' | 'shared'
  title: string
  body: string
  status: Status
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'projects',
    mode: 'shared',
    title: 'Local projects',
    body: 'Create, rename, duplicate, export and import projects. They autosave in your browser, and a project is never overwritten silently.',
    status: 'available',
  },
  {
    id: 'scale',
    mode: 'system',
    title: 'Type scale',
    body: 'Set a base size and ratio and see every step of the modular scale, with the sizes of your typography roles.',
    status: 'available',
  },
  {
    id: 'catalog',
    mode: 'system',
    title: 'Font selection',
    body: 'Choose existing fonts for each role, with the licence of each font recorded alongside it.',
    status: 'planned',
  },
  {
    id: 'roles',
    mode: 'system',
    title: 'Role editing',
    body: 'Edit weights, line heights and letter spacing per role. Today the default roles are shown but not editable.',
    status: 'planned',
  },
  {
    id: 'previews',
    mode: 'system',
    title: 'Brand application previews',
    body: 'See the system in realistic contexts such as a web page, a poster or a document.',
    status: 'planned',
  },
  {
    id: 'tokens',
    mode: 'system',
    title: 'Specification and code export',
    body: 'Export the typography system as documentation and as CSS or JSON tokens.',
    status: 'planned',
  },
  {
    id: 'generator',
    mode: 'typeface',
    title: 'Procedural typeface generator',
    body: 'Three construction families (geometric, rounded and modular) draw letters, digits and most punctuation from design parameters: stroke, width, roundness, corners, terminals, spacing and more. A few symbols are not designed yet; the coverage report says exactly which.',
    status: 'early',
  },
  {
    id: 'overrides',
    mode: 'typeface',
    title: 'Per-glyph overrides',
    body: 'Change one glyph’s shape settings, spacing or outline without touching the rest. Overrides survive global edits until you reset them.',
    status: 'early',
  },
  {
    id: 'variants',
    mode: 'typeface',
    title: 'Variations and restore points',
    body: 'Explore seeded variations of a design, compare them side by side, keep favourites and go back to earlier settings.',
    status: 'early',
  },
  {
    id: 'ttf',
    mode: 'typeface',
    title: 'TrueType and OpenType export',
    body: 'Builds a genuine .ttf (TrueType outlines) or .otf (OpenType with CFF outlines) file from the glyphs that pass validation, with kerning and your names, copyright and licence. The finished file is opened again and compared with the design before it is offered, and each export is recorded in the project history.',
    status: 'available',
  },
  {
    id: 'glyphs',
    mode: 'typeface',
    title: 'Glyph editor',
    body: 'Select any designed glyph and move, add or delete outline points with the pointer or the keyboard, with metric guides, zoom and pan, undo and redo, and a one-click return to the generated shape. Outlines are straight-segment polygons, so this is a point editor, not a Bézier curve editor.',
    status: 'early',
  },
  {
    id: 'preview',
    mode: 'typeface',
    title: 'Text preview',
    body: 'Type your own text or use alphabet, numeral and spacing specimens, with size and spacing controls. The editor preview is drawn from the glyph data; next to it your browser draws the real exported file, and a check compares the two.',
    status: 'early',
  },
  {
    id: 'quality',
    mode: 'typeface',
    title: 'Quality checks',
    body: 'Measured checks for missing glyphs, invalid outlines, alignment, unusual widths, spacing, kerning candidates, missing names and licence, and the exported file itself. Each finding shows its numbers and, where a safe fix exists, offers it. There is no overall score.',
    status: 'early',
  },
]

/** Symbols the generator does not design yet. A test keeps this equal to what the engine really reports as missing. */
export const UNSUPPORTED_SYMBOLS = '&@{}~'

export const byMode = (mode: Capability['mode']) => CAPABILITIES.filter((c) => c.mode === mode)

export interface Faq {
  q: string
  a: string
  group: 'Using it' | 'Fonts and licensing' | 'Limitations'
}

export const FAQS: readonly Faq[] = [
  { group: 'Using it', q: 'Is it free?', a: 'Yes. Everything that exists today is free, with no account. No paid plan exists yet, and no prices or dates have been decided.' },
  { group: 'Using it', q: 'Do I need an account?', a: 'No. There is no sign-up, no server and no database. The studio runs in your browser.' },
  { group: 'Using it', q: 'Where is my work stored?', a: 'In this browser, using IndexedDB. Clearing site data for this site deletes your projects, so export a project file to back up or to move work to another device. If the browser blocks storage, the studio says so and keeps work in memory only until you close the tab.' },
  { group: 'Using it', q: 'Does it use AI?', a: 'No. Typefaces are generated by rules and parameters, not by an AI model, and nothing you create is sent anywhere.' },
  { group: 'Fonts and licensing', q: 'Can I use a font I export commercially?', a: 'That depends on the licence you choose for it. You set the licence and copyright for your typeface and they are written into the file. The studio does not verify licences and nothing here is legal advice.' },
  { group: 'Fonts and licensing', q: 'Why is the app GPL-3.0?', a: 'The studio bundles Font Flux JS, which is GPL-3.0-only, so the app is distributed under the same licence. Fonts you export are your own work and are not covered by the app’s licence.' },
  { group: 'Fonts and licensing', q: 'Can I use existing fonts in a project?', a: 'Not yet. Choosing existing fonts, with their licences recorded, is in development.' },
  { group: 'Limitations', q: 'Which characters can the generator draw?', a: `Uppercase and lowercase letters, digits and most ASCII punctuation. These symbols are not designed yet: ${[...UNSUPPORTED_SYMBOLS].join(' ')}. Inside the app, the Coverage view lists exactly what is in your font and why anything is missing.` },
  { group: 'Limitations', q: 'Which file formats can I export?', a: 'TrueType (.ttf) and OpenType with CFF outlines (.otf) for your generated typeface (only glyphs that pass validation are included), and a project file for any project. WOFF and WOFF2 are not offered: the font library can write them, but they have not been validated here.' },
  { group: 'Limitations', q: 'Will the exported font work in my design tool?', a: 'Exported files have been checked with fontTools, fontkit and Font Flux’s own validator, rendered in Chromium and compared with the preview, and opened by macOS CoreText. They have not been tested in Figma, Illustrator, Glyphs, Windows applications, Firefox or Safari, so test the file in your own tools before relying on it.' },
  { group: 'Limitations', q: 'Which browsers are supported?', a: 'Development and automated tests run in Chromium. Other modern browsers are expected to work but are untested.' },
]
