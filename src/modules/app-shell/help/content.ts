/**
 * The text of the Help panel. It describes what Tynovo does today and nothing it does not: when a feature changes,
 * change it here too (a test checks that every screen has help, and that the keys listed for the glyph editor are the
 * keys the editor handles).
 */
export type HelpScreen = 'projects' | 'overview' | 'fonts' | 'typography' | 'typeface' | 'export' | 'settings' | 'lab' | 'account'

export interface ScreenHelp {
  title: string
  /** What this screen is for, in a sentence. */
  purpose: string
  /** The things you can do here. */
  can: string[]
}

export const SCREEN_HELP: Record<HelpScreen, ScreenHelp> = {
  projects: {
    title: 'Projects',
    purpose: 'Every project you have made, kept in this browser. A built-in sample shows a finished one.',
    can: ['Create a project and choose where to begin: the overview, the font catalog, the typography system or the custom typeface.', 'Open a card, or use its More actions menu to duplicate, download or delete it. Deleting offers a backup file first.', 'Import a project file to bring work from another browser or device.', 'Open the read-only sample to see every screen filled in; Duplicate it to get a copy you can edit.'],
  },
  overview: {
    title: 'Overview and brand direction',
    purpose: 'Who the brand is and what its type must do. The font catalog and font suggestions use this.',
    can: ['Name the brand, describe it, add personality words, and pick use cases and tones.', 'Set how much the type must carry long, small text (readability) and large, expressive text (display use).', 'Optional: describe the brand in a few sentences and let the AI box suggest a direction. Nothing changes until you apply it.', 'The Workflow bar above shows the eight steps; “Next” opens the first one still to do.'],
  },
  fonts: {
    title: 'Font catalog',
    purpose: 'Search and filter the bundled fonts, all under the SIL Open Font License, and add the ones you want to the project.',
    can: ['Search by family name; use Filter for category, tone, use and “drawn for” tags, and Sort for A to Z or best match for your brand.', 'Open a font’s details to see its weights, licence, copyright, version and source, and to set it as the primary or secondary font.', 'Name a font installed on your device: Tynovo checks whether it can find it and says “detected” or “not detected”, which is a best-effort check, not proof.'],
  },
  typography: {
    title: 'Brand Typography System',
    purpose: 'Roles, pairing, the type scale, sizes and previews: how the fonts are used.',
    can: ['Choose a primary and secondary font and apply them to the roles in one step; any role can still differ.', 'Edit each role’s font, weight, size step, line height and letter spacing, and add or remove roles (one of each core kind stays).', 'Set the base size and ratio of the scale, heading and body sizes, fluid sizing and fallback stacks.', 'Preview the system as a website, an editorial page, a product screen, a poster and a printed A4 page, on light or dark, at phone, tablet or fitted width. “Change the sample text” edits the words and keeps them.'],
  },
  typeface: {
    title: 'Custom Typeface Creator',
    purpose: 'Generate an original display typeface from rules, refine it, check it and export it as a real font file.',
    can: ['Pick a construction family (geometric, rounded, modular) and move the design parameters: every glyph redraws.', 'Optional: describe the typeface in words and let the AI box suggest settings. A restore point is saved before they are applied.', 'Open Glyphs to edit single letters with points and curves; Preview to type your own text and compare with the exported file; Coverage, Quality and Font info to check the result.', 'Variants explores seeded alternatives; Save restore point and Restore points bring earlier settings back.'],
  },
  export: {
    title: 'Export',
    purpose: 'Everything the project can produce, built from the saved project and stamped with its revision.',
    can: ['Download a specification, CSS, design tokens, an HTML specimen, a PDF specimen, a sources-and-licences file, the project file, or one zip of them all.', 'Build a font file of your typeface (TrueType, OpenType, WOFF or WOFF2). Each file is opened again and compared with the design before it is offered; a failing file is never offered.', 'Fonts made by others are named, not included (the PDF is the one exception: it embeds the bundled fonts it draws).', 'Exports are built from the saved project, so they wait while changes are still saving.'],
  },
  settings: {
    title: 'Project settings',
    purpose: 'Housekeeping for this project.',
    can: ['Duplicate the project into an independent copy (the export history is not copied).', 'Download the project file as a backup you can import again.', 'See when it was created and last saved, its schema version and where it is stored.', 'Delete it from this browser; you are offered a backup file first. This cannot be undone.'],
  },
  lab: {
    title: 'Font lab',
    purpose: 'A bench for the font writer: build a small TrueType file and check that your browser accepts and draws it.',
    can: ['Use it to confirm that fonts built in this browser load and render here. Your projects are not involved.'],
  },
  account: {
    title: 'Settings',
    purpose: 'Where Tynovo keeps things and what plan applies.',
    can: ['See where your projects are stored and what the current plan includes. There is no account and no sign-in.'],
  },
}

export interface Topic {
  id: string
  title: string
  /** Paragraphs. */
  body: string[]
}

export const TOPICS: Topic[] = [
  {
    id: 'modes',
    title: 'How Tynovo is organised',
    body: ['A project holds one set of data. Two modes work on it: the Brand Typography System (choose existing fonts, assign roles, set a scale, preview, export) and the Custom Typeface Creator (generate and refine an original display typeface). A typeface you make can be assigned to a role in the system, and the previews and exports use it.'],
  },
  {
    id: 'workflow',
    title: 'The workflow bar',
    body: ['It is under the top bar on every screen of a project: eight steps, a marker for each (ticked when done, a warning when it needs attention, hollow when still to do, dashed when optional), and a “Next” button for the first step still to do. Click a step to go to its screen or section. The Workflow button opens the same list with each step’s detail.', 'Steps are worked out from the saved project every time; nothing about them is stored.'],
  },
  {
    id: 'saving',
    title: 'Saving, and where your work lives',
    body: ['Projects save automatically to this browser (IndexedDB). There is no account and no server copy, so clearing this site’s data deletes your projects, and another browser or device will not see them. Download a project file to back up or move work.', 'If saving fails, Tynovo says so and keeps your edits on screen; it never replaces a project silently.'],
  },
  {
    id: 'keys',
    title: 'Glyph editor keys',
    body: ['Arrow keys move the selected points by 1 unit (Shift: 10). [ and ] select the previous or next point. Delete removes points; I inserts one. C turns the segment after a point into a curve, L turns a curve back into a line, M smooths a point, F fits curves to short straight sides. Ctrl or Cmd + Z undoes, Shift + Z redoes. + − 0 zoom and fit; Space and drag pans. Escape clears the selection.'],
  },
  {
    id: 'ai',
    title: 'AI suggestions',
    body: ['Two optional boxes (a brand direction on the Overview, design settings in the typeface editor) suggest values from a few sentences you write. Only that text is sent, only when you press the button, through a small function on Tynovo’s host to Groq. Nothing is stored, nothing changes until you press Apply, and everything works without it. Do not write anything confidential in those boxes.'],
  },
  {
    id: 'limits',
    title: 'What to know',
    body: ['The typeface generator draws the 95 printable ASCII characters (Latin script only, no accents). Most testing was in Chromium; other browsers and design tools are untested. Licences are recorded, never verified, and nothing here is legal advice.'],
  },
]

/** The keys the Help panel lists for the glyph editor, as the editor's own key names, so a test can check them. */
export const GLYPH_KEYS = ['ArrowLeft', '[', ']', 'Delete', 'i', 'c', 'l', 'm', 'f', 'Escape'] as const

export function screenOf(pathname: string): HelpScreen {
  if (pathname === '/app/projects' || pathname === '/app/projects/') return 'projects'
  if (pathname.startsWith('/app/lab')) return 'lab'
  if (pathname === '/app/settings') return 'account'
  const sub = pathname.replace(/^\/app\/projects\/[^/]+\/?/, '').split('/')[0]
  if (sub === 'fonts' || sub === 'typography' || sub === 'typeface' || sub === 'export' || sub === 'settings') return sub
  return 'overview'
}
