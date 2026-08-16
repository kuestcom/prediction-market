import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'

import AdminLayout from '@/app/[locale]/admin/layout'

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }))
vi.mock('next/cache', () => ({ cacheTag: vi.fn() }))

vi.mock('@/app/[locale]/(platform)/_components/PlatformViewerState', () => ({ default: () => null }))
vi.mock('@/app/[locale]/admin/_components/AdminHeader', () => ({ default: () => null }))
vi.mock('@/app/[locale]/admin/_components/AdminOnboardingSupportWidget', () => ({ default: () => null }))
vi.mock('@/app/[locale]/admin/_components/AdminSidebar', () => ({ default: () => null }))
vi.mock('@/app/[locale]/admin/_components/CopyVersion', () => ({ default: () => null }))
vi.mock('@/lib/admin-support-settings', () => ({
  getCompletedAdminOnboardingTasks: vi.fn(() => []),
  getKuestSupportSettings: vi.fn(() => ({ enabled: false, position: 'bottom-right' })),
  getSupportAnnouncementDismissedAt: vi.fn(() => null),
}))
vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: { getSettings: vi.fn(async () => ({ data: {} })) },
}))
vi.mock('@/providers/AppKitProvider', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="app-kit-provider">{children}</div>,
}))
vi.mock('@/providers/CommunityFollowsProvider', () => ({
  CommunityFollowsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="community-follows-provider">{children}</div>
  ),
}))

describe('admin users community follows provider', () => {
  it('renders admin page content inside the community follows provider', async () => {
    const layout = await AdminLayout({
      params: Promise.resolve({ locale: 'en' }),
      children: <div>Admin users content</div>,
    })

    render(layout)

    expect(screen.getByTestId('community-follows-provider')).toContainElement(screen.getByText('Admin users content'))
    expect(screen.getByTestId('app-kit-provider')).toContainElement(screen.getByTestId('community-follows-provider'))
  })
})
