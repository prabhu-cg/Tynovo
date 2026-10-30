import { metaFor } from './pages'
import { Seo } from './Seo'
import { Container, Notice, PageHeader, PrimaryLink, TextLink } from './ui'

export function PricingPage() {
  return (
    <>
      <Seo page={metaFor('/pricing')} />
      <PageHeader eyebrow="Pricing" title="Free today. Paid options are undecided." lead="No plan, price, trial or date exists, and there is no payment system. This page says only what is true now.">
        <PrimaryLink to="/app/projects">Start a project</PrimaryLink>
      </PageHeader>
      <section aria-label="Pricing positions">
        <Container className="grid gap-px py-14 md:py-20">
          <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2">
            <div className="bg-paper p-6 md:p-8">
              <h2 className="text-2xl font-extrabold">Free, now</h2>
              <p className="mt-1 text-4xl font-extrabold text-ink-strong">0</p>
              <ul className="mt-6 grid gap-3">
                {['Everything that exists in Tynovo today', 'No account and no sign-up', 'Projects stored in your browser', 'The font catalog, roles, pairing, previews and exports', 'All three typeface families, the glyph editor with curves, a PDF specimen, and TrueType, OpenType, WOFF and WOFF2 export', 'Licensed under GPL-3.0'].map((t) => (
                  <li key={t} className="border-t border-line pt-3">{t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-paper p-6 md:p-8">
              <h2 className="text-2xl font-extrabold">Paid, maybe later</h2>
              <p className="mt-1 text-4xl font-extrabold text-ink-soft">Undecided</p>
              <p className="mt-6">Tynovo is built to run without a server, which keeps it free to operate. If a paid option is ever introduced, it would be for something that costs money to provide, such as storing projects on a server. Nothing like that exists, and nothing in the free app has been designated to move behind a paywall.</p>
              <p className="mt-4">What a plan includes is kept as configuration in one place in the code, checked by tests, and the interface asks about features, not plan names. That configuration refuses to restrict exporting, importing, upgrading or recovering your own projects, and refuses to take away what is listed as free. There is no checkout, no account and no plan to switch on.</p>
            </div>
          </div>
          <div className="mt-8"><Notice title="Draft positioning">This describes the current intent of the project and has not been reviewed as a commercial commitment. Do not treat it as a promise about future pricing.</Notice></div>
          <p className="mt-8">Questions? Read the <TextLink to="/faq">FAQ</TextLink> or the <TextLink to="/licensing">licensing</TextLink> page.</p>
        </Container>
      </section>
    </>
  )
}
