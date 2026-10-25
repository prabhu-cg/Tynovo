import { LegalPage } from './legal'
import { metaFor } from './pages'
import { Seo } from './Seo'

export function PrivacyPage() {
  return (
    <>
      <Seo page={metaFor('/privacy')} />
      <LegalPage
        eyebrow="Draft"
        title="Privacy notice (draft)"
        lead="What the app does with data, as built today."
        todo={['Name the operator and a contact address', 'State what the hosting provider logs, and for how long', 'Confirm legal bases and rights for the intended jurisdictions', 'Re-check this text whenever analytics, accounts or storage services are added']}
      >
        <h2>Your projects</h2>
        <p>Projects are stored in your browser using IndexedDB. They are not sent to a server, and the operator cannot read them. If you clear site data, they are deleted. A project file you export is saved where you choose.</p>
        <h2>Fonts and files</h2>
        <p>Fonts you generate are built inside your browser. Nothing is uploaded. Fonts used by the interface and the examples are served from this site rather than from a third party.</p>
        <h2>What the app does not do today</h2>
        <ul>
          <li>No account or sign-in.</li>
          <li>No analytics or tracking scripts.</li>
          <li>No advertising.</li>
          <li>No cookies set by the app.</li>
          <li>No AI service receives your content.</li>
        </ul>
        <h2>Hosting</h2>
        <p>Whoever hosts the site can see ordinary web-server information, such as IP addresses and requested pages, in server logs. That is outside the app and depends on the hosting arrangement, which has not been decided.</p>
        <h2>Changes</h2>
        <p>If the app starts collecting any data, this notice must be updated before that ships.</p>
      </LegalPage>
    </>
  )
}
