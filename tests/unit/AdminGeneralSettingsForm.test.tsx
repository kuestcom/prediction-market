import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'

const mocks = vi.hoisted(() => ({
  removeTermsOfServicePdfAction: vi.fn(),
}))

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
  removeTermsOfServicePdfAction: (...args: any[]) => mocks.removeTermsOfServicePdfAction(...args),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'allowed-market-creators-manager' }),
}))

describe('adminGeneralSettingsForm', () => {
  beforeEach(() => {
    mocks.removeTermsOfServicePdfAction.mockReset()
  })

  it('invokes the remove PDF action from the legal section', async () => {
    const user = userEvent.setup()
    mocks.removeTermsOfServicePdfAction.mockResolvedValueOnce({ error: null })

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
          customJavascriptCodes: [],
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        initialGlobalAnnouncement={{
          message: '',
          linkUrl: '',
          disabledOn: [],
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath="legal/current-terms.pdf"
        initialTermsOfServicePdfUrl="https://cdn.example.com/legal/current-terms.pdf"
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Legal/i }))
    expect((container.querySelector('input[name="tos_pdf_path"]') as HTMLInputElement).value).toBe('legal/current-terms.pdf')
    await user.click(screen.getByRole('button', { name: /Remove uploaded PDF/i }))

    await waitFor(() => {
      expect(mocks.removeTermsOfServicePdfAction).toHaveBeenCalledTimes(1)
      expect((container.querySelector('input[name="tos_pdf_path"]') as HTMLInputElement).value).toBe('')
    })
  })

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
          customJavascriptCodes: [],
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        initialGlobalAnnouncement={{
          message: '',
          linkUrl: '',
          disabledOn: [],
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath=""
        initialTermsOfServicePdfUrl={null}
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
    expect(container.querySelector('input[name="tos_pdf_path"]')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
  })
})
