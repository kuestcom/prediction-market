import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import * as React from 'react'

import AdminOnboardingSupportWidget from '@/app/[locale]/admin/_components/AdminOnboardingSupportWidget'

import { hoisted, stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  updateAdminOnboardingTaskAction: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => (typeof value === 'string' ? value : value.message),
}))

void mock.module('@/app/[locale]/admin/_actions/update-admin-support', () => ({
  createAdminSupportContextAction: mock(),
  dismissSupportAnnouncementAction: mock(),
  updateAdminOnboardingTaskAction: mocks.updateAdminOnboardingTaskAction,
}))

void mock.module('@/app/[locale]/admin/_components/AdminSupportInvoicePaymentHandler', () => ({
  default: () => null,
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    error: mock(),
  },
}))

void mock.module('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('admin onboarding support widget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    stubGlobal(
      'fetch',
      mock().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    )
    mocks.updateAdminOnboardingTaskAction.mockResolvedValue(undefined)
  })

  afterEach(() => {
    unstubAllGlobals()
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
