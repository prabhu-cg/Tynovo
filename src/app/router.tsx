import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { NotFoundPage } from '@/modules/app-shell/NotFoundPage'
import { HomePage } from '@/modules/marketing/HomePage'
import { MarketingLayout } from '@/modules/marketing/MarketingLayout'

/** Lazy route helper: each page becomes its own chunk, loaded on navigation. */
const lazyPage = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T & string) => ({
  lazy: async () => ({ Component: (await load())[name] as React.ComponentType }),
})

/** Public website under "/", the application under "/app". They share only tokens and shared-ui. */
export const routes: RouteObject[] = [
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/features', ...lazyPage(() => import('@/modules/marketing/FeaturesPage'), 'FeaturesPage') },
      { path: '/how-it-works', ...lazyPage(() => import('@/modules/marketing/HowItWorksPage'), 'HowItWorksPage') },
      { path: '/pricing', ...lazyPage(() => import('@/modules/marketing/PricingPage'), 'PricingPage') },
      { path: '/examples', ...lazyPage(() => import('@/modules/marketing/ExamplesPage'), 'ExamplesPage') },
      { path: '/licensing', ...lazyPage(() => import('@/modules/marketing/LicensingPage'), 'LicensingPage') },
      { path: '/faq', ...lazyPage(() => import('@/modules/marketing/FaqPage'), 'FaqPage') },
      { path: '/privacy', ...lazyPage(() => import('@/modules/marketing/PrivacyPage'), 'PrivacyPage') },
      { path: '/terms', ...lazyPage(() => import('@/modules/marketing/TermsPage'), 'TermsPage') },
    ],
  },
  {
    path: '/app',
    lazy: async () => ({ Component: (await import('@/modules/app-shell/AppLayout')).AppLayout }),
    children: [
      { index: true, element: <Navigate to="/app/projects" replace /> },
      { path: 'projects', ...lazyPage(() => import('@/modules/app-shell/DashboardPage'), 'DashboardPage') },
      {
        path: 'projects/:projectId',
        lazy: async () => ({ Component: (await import('@/modules/app-shell/ProjectLayout')).ProjectLayout }),
        children: [
          { index: true, ...lazyPage(() => import('@/modules/app-shell/OverviewPage'), 'OverviewPage') },
          { path: 'typography', ...lazyPage(() => import('@/modules/app-shell/TypographyPage'), 'TypographyPage') },
          { path: 'typeface', ...lazyPage(() => import('@/modules/app-shell/TypefacePage'), 'TypefacePage') },
          { path: 'export', ...lazyPage(() => import('@/modules/app-shell/ExportPage'), 'ExportPage') },
          { path: 'settings', ...lazyPage(() => import('@/modules/app-shell/ProjectSettingsPage'), 'ProjectSettingsPage') },
        ],
      },
      { path: 'lab', ...lazyPage(() => import('@/modules/font-export/FontLabPage'), 'FontLabPage') },
      { path: 'settings', ...lazyPage(() => import('@/modules/app-shell/SettingsPage'), 'SettingsPage') },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
