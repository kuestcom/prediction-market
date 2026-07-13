import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { DEFAULT_HOME_FEATURED_SETTINGS } from '@/lib/home-featured-settings'

const mocks = vi.hoisted(() => ({
  removeTermsOfServicePdfAction: vi.fn(),
  updateGeneralSettingsAction: vi.fn(),
  optimizeSideCardImage: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  useIsMobile: vi.fn(() => false),
}))

const marketContextProps = {
  initialMarketContextSettings: {
    enabled: true,
    prompt: 'Summarize the current market context clearly.',
  },
  marketContextVariables: [{
    key: 'event-title',
    label: 'Event title',
    description: 'Full event headline.',
  }],
}

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string, variables?: Record<string, string>) => (
    Object.entries(variables ?? {}).reduce(
      (message, [key, replacement]) => message.replaceAll(`{${key}}`, replacement),
      value,
    )
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, unoptimized: _unoptimized, ...props }: any) => React.createElement('img', props),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mocks.toastSuccess(...args),
    error: (...args: any[]) => mocks.toastError(...args),
  },
}))

vi.mock('@/app/[locale]/admin/(general)/_actions/update-general-settings', () => ({
  updateGeneralSettingsAction: (...args: any[]) => mocks.updateGeneralSettingsAction(...args),
  removeTermsOfServicePdfAction: (...args: any[]) => mocks.removeTermsOfServicePdfAction(...args),
}))

vi.mock('@/lib/side-card-image-client', () => ({
  optimizeSideCardImage: (...args: any[]) => mocks.optimizeSideCardImage(...args),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'allowed-market-creators-manager' }),
}))

describe('adminGeneralSettingsForm', () => {
  beforeEach(() => {
    mocks.removeTermsOfServicePdfAction.mockReset()
    mocks.updateGeneralSettingsAction.mockReset()
    mocks.optimizeSideCardImage.mockReset()
    mocks.createObjectURL.mockReset()
    mocks.revokeObjectURL.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()
    mocks.useIsMobile.mockReset()
    mocks.useIsMobile.mockReturnValue(false)
    mocks.updateGeneralSettingsAction.mockResolvedValue({ error: null })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mocks.createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mocks.revokeObjectURL,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('invokes the remove PDF action from the legal section', async () => {
    const user = userEvent.setup()
    mocks.removeTermsOfServicePdfAction.mockResolvedValueOnce({ error: null })

    const { container } = render(
      <AdminGeneralSettingsForm
        {...marketContextProps}
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
          disableFaucetBanner: false,
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
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
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

  it('places Market Context above featured markets and submits it through the global form', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AdminGeneralSettingsForm
        {...marketContextProps}
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
          disableFaucetBanner: false,
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
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
    const marketContextButton = screen.getByRole('button', { name: 'Market Context' })
    const featuredMarketsButton = screen.getByRole('button', { name: 'Featured markets' })
    expect(marketContextButton).toHaveAttribute('aria-expanded', 'false')
    expect(marketContextButton.compareDocumentPosition(featuredMarketsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('input[name="site_name"]')).toBeTruthy()
    expect(container.querySelector('input[name="google_analytics_id"]')).toBeTruthy()
    expect(container.querySelector('input[name="tos_pdf_path"]')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')

    await user.click(marketContextButton)
    expect(screen.getByRole('columnheader', { name: 'Variables' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeVisible()
    const addVariableButton = screen.getByRole('button', { name: 'Add [event-title] variable' })
    await user.hover(addVariableButton)
    expect(await screen.findByRole('tooltip', { name: 'Insert into prompt' })).toBeInTheDocument()

    const prompt = screen.getByRole('textbox', { name: 'Prompt template' })
    await user.clear(prompt)
    await user.type(prompt, 'Summarize current market context clearly.')
    await user.click(screen.getByRole('switch', { name: 'Enable market context' }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(mocks.updateGeneralSettingsAction).toHaveBeenCalledOnce())
    const formData = mocks.updateGeneralSettingsAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('market_context_prompt')).toBe('Summarize current market context clearly.')
    expect(formData.get('market_context_enabled')).toBe('false')
  })

  it('uses mobile drawers for featured market editors and saves drafts from the global action', async () => {
    const user = userEvent.setup()
    mocks.useIsMobile.mockReturnValue(true)

    render(
      <AdminGeneralSettingsForm
        {...marketContextProps}
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
          disableFaucetBanner: false,
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath=""
        initialTermsOfServicePdfUrl={null}
        initialHomeFeaturedEvents={[{
          targetType: 'event',
          eventId: 'event-1',
          seriesSlug: null,
          title: 'Example market',
          slug: 'example-market',
          iconUrl: null,
          enabled: true,
          rank: 0,
          source: 'manual',
          startsAt: null,
          endsAt: null,
          contextMode: 'auto',
          autoRolloverEnabled: false,
          contextItems: [],
        }]}
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Featured markets' }))

    await user.click(screen.getByRole('button', { name: 'Add market' }))
    const addMarketDrawer = screen.getByRole('dialog', { name: 'Add featured markets' })
    expect(addMarketDrawer).toHaveAttribute('data-vaul-drawer')
    await user.click(within(addMarketDrawer).getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Selection and context settings' }))

    const dialog = screen.getByRole('dialog', { name: 'Selection and context settings' })
    expect(dialog).toHaveAttribute('data-vaul-drawer')
    expect(within(dialog).getByRole('switch', { name: 'Sports live/today' })).toBeVisible()
    expect(within(dialog).getByRole('switch', { name: 'New events' })).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Comment blacklist' }), 'test')
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Side card' }))
    const sideCardDrawer = screen.getByRole('dialog', { name: 'Side card' })
    expect(sideCardDrawer).toHaveAttribute('data-vaul-drawer')
    await user.click(within(sideCardDrawer).getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Manage context' }))
    const contextDrawer = screen.getByRole('dialog', { name: 'Manage context' })
    expect(contextDrawer).toHaveAttribute('data-vaul-drawer')
    await user.click(within(contextDrawer).getByRole('button', { name: 'Cancel' }))

    expect(mocks.updateGeneralSettingsAction).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(mocks.updateGeneralSettingsAction).toHaveBeenCalledOnce())
    const formData = mocks.updateGeneralSettingsAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('home_featured_comment_blacklist')).toBe('test')
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Settings saved successfully!'))
  })

  it('submits the optimized side card image instead of the original file', async () => {
    const user = userEvent.setup()
    const originalFile = new File(['original'], 'side-card.png', { type: 'image/png' })
    const optimizedFile = new File(['optimized'], 'side-card.jpg', { type: 'image/jpeg' })
    mocks.optimizeSideCardImage.mockResolvedValueOnce(optimizedFile)
    mocks.createObjectURL.mockReturnValueOnce('blob:optimized-side-card')

    const { container } = render(
      <AdminGeneralSettingsForm
        {...marketContextProps}
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
          disableFaucetBanner: false,
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath=""
        initialTermsOfServicePdfUrl={null}
        initialHomeFeaturedSettings={{
          ...DEFAULT_HOME_FEATURED_SETTINGS,
          sideCard: {
            ...DEFAULT_HOME_FEATURED_SETTINGS.sideCard,
            useImage: true,
          },
        }}
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    const sideCardInput = container.querySelector('#home-featured-side-card-image-file') as HTMLInputElement
    await user.upload(sideCardInput, originalFile)

    await waitFor(() => {
      expect(mocks.optimizeSideCardImage).toHaveBeenCalledWith(originalFile)
      expect(mocks.createObjectURL).toHaveBeenCalledWith(optimizedFile)
      expect(screen.getByRole('button', { name: /Save settings/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Save settings/i }))

    await waitFor(() => expect(mocks.updateGeneralSettingsAction).toHaveBeenCalledOnce())
    const [previousState, formData] = mocks.updateGeneralSettingsAction.mock.calls[0] as [
      { error: null },
      FormData,
    ]
    expect(previousState).toEqual({ error: null })
    expect(formData.get('home_featured_side_card_image')).toBe(optimizedFile)
  })
})
