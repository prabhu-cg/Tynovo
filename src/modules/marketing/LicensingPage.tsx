import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, PageHeader, TextLink } from './ui'

const BLOCKS = [
  {
    id: 'app',
    title: 'The app',
    body: (
      <>
        <p>Brand Typography Studio is released under the GNU General Public License v3.0 (only). It bundles Font Flux JS, which is GPL-3.0-only, so the whole app must be distributed under the same terms, with its source available to the people who receive it.</p>
        <p className="mt-3">The interface font, Manrope, and the example fonts Fraunces and IBM Plex Mono are used under the SIL Open Font License 1.1 and are self-hosted: this site does not load fonts from a third party.</p>
      </>
    ),
  },
  {
    id: 'sources',
    title: 'Fonts made by others',
    body: (
      <>
        <p>Existing fonts keep their own licences, whatever the studio is licensed under. The 24 fonts in the catalog are all under the SIL Open Font License 1.1, read from each font’s package metadata rather than from a legal review. For a font you name yourself, the studio records the licence you say it has and does not verify it. Exports never include the file of a font made by someone else, and the sources and licences file says so for each one.</p>
        <p className="mt-3">Check a font’s licence yourself before using it commercially, in an app, on a website or in a logo. Licences differ on exactly those uses.</p>
      </>
    ),
  },
  {
    id: 'generated',
    title: 'Fonts you generate',
    body: (
      <>
        <p>A font exported from the studio is your work. Its licence is the one you set for your typeface, written into the font’s name table together with your copyright line. It is not covered by the GPL that applies to the app, and the studio does not tell you which licence to choose.</p>
        <p className="mt-3">Until you set one, the typeface is marked as unverified and the export screen says so. Exported files are not legal advice and carry no licensing guarantee.</p>
      </>
    ),
  },
  {
    id: 'product',
    title: 'Product terms',
    body: (
      <p>Terms of use and a privacy notice exist only as drafts and are pending review before a public launch. Read them at <TextLink to="/terms">terms (draft)</TextLink> and <TextLink to="/privacy">privacy (draft)</TextLink>.</p>
    ),
  },
]

export function LicensingPage() {
  return (
    <>
      <Seo page={metaFor('/licensing')} />
      <PageHeader eyebrow="Licensing" title="Four things, licensed separately." lead="Mixing them up causes real problems, so the studio keeps them apart." />
      <Container className="py-14 md:py-20">
        <div className="divide-y divide-line border-y border-line">
          {BLOCKS.map((b) => (
            <section key={b.id} aria-labelledby={`${b.id}-h`} className="grid gap-4 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] md:gap-14">
              <h2 id={`${b.id}-h`} className="text-2xl font-extrabold">{b.title}</h2>
              <div className="max-w-2xl">{b.body}</div>
            </section>
          ))}
        </div>
      </Container>
    </>
  )
}
