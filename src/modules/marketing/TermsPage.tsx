import { LegalPage } from './legal'
import { metaFor } from './pages'
import { Seo } from './Seo'
import { TextLink } from './ui'

export function TermsPage() {
  return (
    <>
      <Seo page={metaFor('/terms')} />
      <LegalPage
        eyebrow="Draft"
        title="Terms of use (draft)"
        lead="Plain-language starting point for terms. Not yet binding."
        todo={['Name the operator and governing jurisdiction', 'Have a lawyer write the warranty, liability and dispute clauses', 'Decide acceptable-use rules', 'Align with the final pricing and licensing decisions']}
      >
        <h2>Using the studio</h2>
        <p>The studio is a tool that runs in your browser. You decide what to create and what to do with it.</p>
        <h2>Your work</h2>
        <p>You keep the work you create. You are responsible for having the right to use any font, text or image you put into a project, and for the licence you choose for a typeface you export.</p>
        <h2>Third-party fonts</h2>
        <p>Fonts made by others keep their own licences. The studio records the licence you enter and does not verify it. See <TextLink to="/licensing">licensing</TextLink>.</p>
        <h2>The software</h2>
        <p>The app is licensed under the GNU GPL v3.0 (only), which includes its own disclaimer of warranty.</p>
        <h2>Availability and changes</h2>
        <p>The studio is early software. Features can change or be removed, and stored data can be lost if you clear your browser data, so export project files for anything important.</p>
      </LegalPage>
    </>
  )
}
