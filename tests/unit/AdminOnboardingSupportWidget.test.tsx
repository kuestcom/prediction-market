import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { beforeEach, describe, expect, afterEach, it, vi } from 'vitest'

import AdminOnboardingSupportWidget from '@/app/[locale]/admin/_components/AdminOnboardingSupportWidget'

const mocks = vi.hoisted(() => ({
  updateAdminOnboardingTaskAction: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => (typeof value === 'string' ? value : value.message),
}))

vi.mock('@/app/[locale]/admin/_actions/update-admin-support', () => ({
  createAdminSupportContextAction: vi.fn(),
  dismissSupportAnnouncementAction: vi.fn(),
  updateAdminOnboardingTaskAction: mocks.updateAdminOnboardingTaskAction,
}))

vi.mock('@/app/[locale]/admin/_components/AdminSupportInvoicePaymentHandler', () => ({
  default: () => null,
}))

vi.mock('@/components/ui/toast', () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('admin onboarding support widget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    )
    mocks.updateAdminOnboardingTaskAction.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('links to translation settings with guidance and records the task', async () => {
    render(<AdminOnboardingSupportWidget announcementDismissedAt={null} initialCompletedTasks={[]} position="right" />)

    const translationLink = screen.getByRole('link', { name: /Configure translations/ })
    expect(translationLink).toHaveAttribute('href', '/admin/locales')
    expect(
      screen.queryByText('Order language preferences and disable unused locales to speed up translations.'),
    ).toBeNull()

    fireEvent.click(translationLink)

    await waitFor(() => {
      expect(mocks.updateAdminOnboardingTaskAction).toHaveBeenCalledWith('translations', true)
    })
  })
})
