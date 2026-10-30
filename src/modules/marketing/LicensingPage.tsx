import type { ReactNode } from 'react'
import { CATALOG } from '@/modules/font-catalog/catalog'
import { External, LEGAL_UPDATED, PROJECT_URL } from './legal'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, TextLink } from './ui'

/**
 * Software Tynovo ships with, and its licence. A unit test compares this list with the packages installed, so it
 * cannot drift from what is really bundled.
 */
export const SOFTWARE: ReadonlyArray<{ name: string; license: string; use: string; url: string }> = [
  { name: 'Font Flux JS', license: 'GPL-3.0-only', use: 'Writes the TrueType and OpenType font files you export.', url: 'https://www.glyphrstudio.com/fontfluxjs/' },
  { name: 'React and React DOM', license: 'MIT', use: 'The interface.', url: 'https://react.dev/' },
  { name: 'React Router', license: 'MIT', use: 'Navigation between pages.', url: 'https://github.com/remix-run/react-router' },
  { name: 'Zod', license: 'MIT', use: 'Checks that project data is valid.', url: 'https://zod.dev' },
  { name: 'idb', license: 'ISC', use: 'Saves projects in your browser.', url: 'https://github.com/jakearchibald/idb' },
  { name: 'polygon-clipping', license: 'MIT', use: 'Combines shapes when a typeface is drawn.', url: 'https://github.com/mfogel/polygon-clipping' },
]

interface Block {
  id: string
  title: string
  body: ReactNode
}

function FontTable() {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-line" role="region" aria-label="Fonts bundled with Tynovo" tabIndex={0}>
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">The {CATALOG.length} fonts bundled with Tynovo, their licence and copyright line</caption>
        <thead className="bg-sheet text-xs text-ink-soft uppercase">
          <tr><th scope="col" className="px-3 py-2 font-semibold">Font</th><th scope="col" className="px-3 py-2 font-semibold">Licence</th><th scope="col" className="px-3 py-2 font-semibold">Copyright</th><th scope="col" className="px-3 py-2 font-semibold">Source</th></tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {CATALOG.map((f) => (
            <tr key={f.id} data-font={f.family}>
              <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-ink-strong">{f.family}</th>
              <td className="px-3 py-2 whitespace-nowrap">{f.license.spdx}</td>
              <td className="px-3 py-2 break-words">{f.license.copyright}</td>
              <td className="px-3 py-2"><External href={f.page}>{f.distribution}</External></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const BLOCKS: readonly Block[] = [
  {
    id: 'app',
    title: 'The software',
    body: (
      <>
        <p>Tynovo is released under the GNU General Public License v3.0 (only). The full text is in the <External href={`${PROJECT_URL}/blob/main/LICENSE`}>LICENSE file</External> of the <External href={PROJECT_URL}>public repository</External>, where the complete source code is available.</p>
        <p className="mt-3">Under that licence you may use, study, change and share the software, and share your changes, provided you pass on the same freedoms and the source. It comes with no warranty. Tynovo bundles Font Flux JS, which is GPL-3.0-only, so the whole application must be distributed under the same terms.</p>
        <h3 className="mt-6 text-lg font-bold">Software it is built with</h3>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {SOFTWARE.map((s) => (
            <li key={s.name} className="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[11rem_6.5rem_minmax(0,1fr)]">
              <span className="font-semibold text-ink-strong"><External href={s.url}>{s.name}</External></span>
              <span className="tnum">{s.license}</span>
              <span>{s.use}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-soft">The full licence text of every package Tynovo ships, the bundled fonts included, is in the <a href="/third-party-notices.txt" className="font-semibold text-accent-strong underline decoration-1 underline-offset-4 hover:text-accent-text">third-party notices</a>, generated when the site is built. They are all compatible with the GPL.</p>
      </>
    ),
  },
  {
    id: 'bundled',
    title: 'Fonts bundled with Tynovo',
    body: (
      <>
        <p>The {CATALOG.length} fonts in the catalog, including the interface font Manrope and the example fonts Fraunces and IBM Plex Mono, are licensed by their authors under the SIL Open Font License 1.1. The licence text is at <External href="https://openfontlicense.org/open-font-license-official-text/">openfontlicense.org</External>.</p>
        <p className="mt-3">In short, the OFL lets you use these fonts for any purpose, including commercially, and study, change and share them, but not sell them on their own, and a changed version may not use the font’s Reserved Font Name. Tynovo does not change them. They are served from this site, not from a third party, and they load only when you preview or use them.</p>
        <p className="mt-3">Category, weights, licence, copyright and version are read from each font’s own package metadata, not from a legal review. Tynovo does not include these fonts’ files in your exports: it names them, and the sources and licences file says where each comes from and under what licence. The one exception is the PDF specimen, which embeds the fonts it draws, as the SIL Open Font License allows in a document.</p>
        <FontTable />
      </>
    ),
  },
  {
    id: 'sources',
    title: 'Fonts made by others',
    body: (
      <>
        <p>Any other font keeps its own licence, whatever Tynovo is licensed under. When you name a font installed on your device, Tynovo records the licence you say it has and does not verify it. Exports name the font but never include its file.</p>
        <p className="mt-3">Check a font’s licence yourself before you use it commercially, in an app, on a website or in a logo. Licences differ on exactly those uses, and the font file may need to be supplied separately.</p>
      </>
    ),
  },
  {
    id: 'generated',
    title: 'Fonts you generate',
    body: (
      <>
        <p>A font exported from Tynovo is your work. Its licence is the one you set for your typeface. The licence name and address, and your copyright line, are written into the font’s name table, so anyone who receives the file can read them. The font is not covered by the GPL that applies to the software, and Tynovo does not tell you which licence to choose.</p>
        <p className="mt-3">Until you set one, the typeface is marked as unverified, the font file carries no licence, and the export screen says so. Tynovo draws typefaces from rules and parameters and does not copy existing fonts, but it cannot guarantee that a design is unique, so check names and designs before you publish or sell a font. Exported files are not legal advice and carry no licensing guarantee.</p>
      </>
    ),
  },
  {
    id: 'exports',
    title: 'Documents and code you export',
    body: (
      <>
        <p>The specification, CSS, JSON tokens, specimen, sources and licences file, project file and package you export contain your decisions, and they are yours. They describe other makers’ fonts by name and licence but do not contain those fonts. The HTML specimen embeds only a typeface you generated yourself.</p>
        <p className="mt-3">The sources and licences file records, for each font a role uses, where it comes from, its licence, whether you have confirmed it, and whether its file is part of the export. Use it when you hand the work to someone else.</p>
      </>
    ),
  },
  {
    id: 'name',
    title: 'The Tynovo name and logo',
    body: (
      <p>The GPL covers the software’s code. The Tynovo name and logo identify this project and are not part of that grant: please do not use them to suggest that your work comes from, or is endorsed by, the Tynovo project. You are free to say that you made something with Tynovo.</p>
    ),
  },
  {
    id: 'terms',
    title: 'Terms and privacy',
    body: (
      <p>How you may use the hosted website is set out in the <TextLink to="/terms">terms of use</TextLink>, and what happens to data in the <TextLink to="/privacy">privacy notice</TextLink>. Neither limits the rights the GPL gives you over the code.</p>
    ),
  },
]

export function LicensingPage() {
  return (
    <>
      <Seo page={metaFor('/licensing')} />
      <PageHeader title="Licensed separately, on purpose." lead="The software, the fonts that come with it, the fonts you choose and the fonts you generate each have their own licence. Mixing them up causes real problems, so Tynovo keeps them apart." />
      <Container className="py-14 md:py-20">
        <p className="tnum mb-6 text-sm text-ink-soft">Last updated {LEGAL_UPDATED}. Plain language, not legal advice.</p>
        <div className="divide-y divide-line border-y border-line">
          {BLOCKS.map((b) => (
            <section key={b.id} id={b.id} aria-labelledby={`${b.id}-h`} className="grid gap-4 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] md:gap-14">
              <h2 id={`${b.id}-h`} className="text-2xl font-extrabold">{b.title}</h2>
              <div className="min-w-0 max-w-3xl">{b.body}</div>
            </section>
          ))}
        </div>
      </Container>
    </>
  )
}
