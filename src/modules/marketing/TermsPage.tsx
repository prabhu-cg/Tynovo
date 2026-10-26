import { CONTACT_URL, External, LegalPage, type LegalSection } from './legal'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { TextLink } from './ui'

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>These terms cover your use of the Tynovo website and web application (together, “Tynovo”). By using Tynovo you agree to them. If you do not agree, please do not use it.</p>
        <p>Tynovo is an open-source project run by its maintainers, who are “we” in these terms. The software itself is licensed separately under the GNU General Public License (see section 5).</p>
      </>
    ),
  },
  {
    id: 'service',
    title: 'What Tynovo is',
    body: (
      <>
        <p>Tynovo is a free tool that runs in your browser. It helps you describe a brand, choose and pair fonts, set a type scale, design an original typeface and export files. There is no account to create.</p>
        <p>It is early software. Some things are unfinished, and the website says which features are available now and which are not. Features can change, move or be removed.</p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your projects and what you make',
    body: (
      <>
        <p>You keep everything you create: your projects, your notes, your typeface designs and the files you export. Your projects are stored in your browser and are never sent to us, so we do not receive them and need no licence to them.</p>
        <p>You are responsible for having the right to use anything you put into a project, such as text, names and the fonts you choose, and for how you use the files you export.</p>
      </>
    ),
  },
  {
    id: 'fonts',
    title: 'Fonts and licences',
    body: (
      <>
        <ul>
          <li><strong>Catalog fonts</strong> are under the SIL Open Font License 1.1. Their licences, copyright lines and sources are listed on the <TextLink to="/licensing">licensing page</TextLink>. Exports name these fonts but never include their files.</li>
          <li><strong>Fonts you name yourself</strong> keep their own licences. Tynovo records the licence you enter and does not verify it. You are responsible for checking that your use, such as on a website, in an app or in a logo, is allowed.</li>
          <li><strong>Typefaces you generate</strong> are yours, and you choose their licence. Tynovo draws them from rules and parameters and does not copy existing fonts, but it cannot promise that a design is unique or free of anyone else’s rights, so check names and designs before you publish or sell a font.</li>
        </ul>
        <p>Tynovo does not give legal advice. Licence fields, manifests and checks describe what you entered and what was measured; they are not a guarantee.</p>
      </>
    ),
  },
  {
    id: 'software',
    title: 'The software licence',
    body: (
      <>
        <p>The Tynovo code is licensed under the GNU General Public License v3.0 (only). That licence, not these terms, governs your right to copy, study, change and share the code, and nothing here limits those rights. If these terms and the GPL ever conflict about the code, the GPL wins.</p>
        <p>These terms apply to your use of the hosted website and application, which is a service run by the maintainers. The Tynovo name and logo are not part of the GPL’s grant: please do not use them to suggest that your work comes from, or is endorsed by, the Tynovo project.</p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Please use Tynovo in good faith. You agree not to:</p>
        <ul>
          <li>break the law with it, or use it to infringe other people’s rights;</li>
          <li>attack, probe, overload or disrupt the site or its hosting, including with automated requests at a rate that harms other people’s use;</li>
          <li>try to get around technical limits or access something you are not meant to reach;</li>
          <li>present files you made as being produced or endorsed by the Tynovo project.</li>
        </ul>
        <p>Running your own copy of the open-source code is a different matter and is governed by the GPL.</p>
      </>
    ),
  },
  {
    id: 'data',
    title: 'Keeping your work safe',
    body: (
      <>
        <p>Projects live in your browser, so clearing site data, using a private window, or a browser clearing storage can delete them. Export a project file for anything you cannot afford to lose. Tynovo offers a backup before you delete a project, and recovers what it can from a damaged one, but it cannot restore what your browser has removed.</p>
        <p>Exporting, importing, upgrading and recovering your own projects are built so that no plan setting can restrict them.</p>
      </>
    ),
  },
  {
    id: 'warranty',
    title: 'No warranty',
    body: (
      <>
        <p>Tynovo is provided “as is” and “as available”, without promises that it will be error-free, uninterrupted or fit for a particular purpose. Exported fonts are checked and read back before they are offered, and the website lists what they were tested in; that does not mean they will work in every program, so test a font in the tools you rely on.</p>
        <p>The GPL has its own disclaimer of warranty for the code.</p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Limits on liability',
    body: (
      <>
        <p>To the fullest extent the law allows, the maintainers are not liable for indirect or consequential loss, lost profits, lost data or lost business arising from your use of Tynovo, and total liability for anything arising from it is limited to the amount you paid us for it, which is nothing.</p>
        <p>Nothing in these terms excludes or limits liability that cannot be excluded or limited by law, such as for fraud or for death or personal injury caused by negligence, or removes rights you have as a consumer where you live.</p>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'Other people’s sites and services',
    body: <p>Tynovo links to other sites and runs on a hosting provider’s service. Those belong to other people, have their own terms and policies, and are not our responsibility.</p>,
  },
  {
    id: 'changes-service',
    title: 'Changes to Tynovo and to what it costs',
    body: (
      <>
        <p>We may change, suspend or stop any part of Tynovo. Tynovo is free today and has no payment system. If paid options are ever introduced, they will be announced on the website and these terms and the <TextLink to="/privacy">privacy notice</TextLink> will be updated before anything is charged. Nothing in these terms is a promise about future pricing.</p>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: <p>You can stop using Tynovo at any time and delete your projects from the application or by clearing the site’s data in your browser. We may block access that breaks the acceptable-use rules above.</p>,
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <>
        <p>These terms do not choose a particular country’s law or courts. The law that applies to you, including any mandatory consumer-protection rights where you live, continues to apply.</p>
        <p>If something goes wrong, please raise it first at <External href={CONTACT_URL}>the project’s issue tracker</External> so it can be sorted out directly.</p>
      </>
    ),
  },
  {
    id: 'changes-terms',
    title: 'Changes to these terms',
    body: <p>We may update these terms. The date at the top shows when they last changed, and using Tynovo after a change means you accept the new version. We will not make a change that takes away rights the GPL gives you over the code.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>Questions about these terms: open an issue at <External href={CONTACT_URL}>the project’s issue tracker</External>. Issues are public, so please leave out personal data.</p>,
  },
]

export function TermsPage() {
  return (
    <>
      <Seo page={metaFor('/terms')} />
      <LegalPage title="Terms of use" lead="The rules for using Tynovo, in plain language: what you keep, what you are responsible for, and what we do not promise." sections={SECTIONS} />
    </>
  )
}
