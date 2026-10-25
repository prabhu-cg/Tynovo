import { Link } from 'react-router'
import { Seo } from '@/modules/marketing/Seo'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <Seo page={{ path: '/404', title: 'Page not found', description: 'This page does not exist.', indexable: false }} />
      <p className="text-sm font-semibold text-accent-strong">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">That page does not exist.</h1>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline underline-offset-4" to="/">Back to the home page</Link>
        <Link className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline underline-offset-4" to="/app/projects">Open your projects</Link>
      </p>
    </main>
  )
}
