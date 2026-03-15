import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, unoptimized: _unoptimized, ...props }: any) => React.createElement('img', props),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/app/[locale]/admin/(general)/_actions/update-general-settings', () => ({
  updateGeneralSettingsAction: vi.fn(),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'allowed-market-creators-manager' }),
}))

describe('adminGeneralSettingsForm', () => {
  it('starts with sections collapsed and keeps inputs mounted while toggling', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AdminGeneralSettingsForm
        initialThemeSiteSettings={{
          siteName: 'Kuest',
          siteDescription: 'Prediction market',
          logoMode: 'svg',
          logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          logoImagePath: '',
          logoImageUrl: null,
          pwaIcon192Path: '',
          pwaIcon192Url: '/icon-192.png',
          pwaIcon512Path: '',
          pwaIcon512Url: '/icon-512.png',
          googleAnalyticsId: '',
          discordLink: '',
          twitterLink: '',
          facebookLink: '',
          instagramLink: '',
          tiktokLink: '',
          linkedinLink: '',
          youtubeLink: '',
          supportUrl: '',
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('input[name="site_name"]')).toBeTruthy()
    expect(container.querySelector('input[name="google_analytics_id"]')).toBeTruthy()
    expect(container.querySelector('input[name="fee_recipient_wallet"]')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
  })
})
