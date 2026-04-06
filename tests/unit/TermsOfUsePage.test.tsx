import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getTermsOfServicePdfUrl: vi.fn(),
  getThemeSiteSettingsFormState: vi.fn(),
  loadRuntimeThemeState: vi.fn(),
  setRequestLocale: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/terms-of-service', () => ({
  getTermsOfServicePdfUrl: (...args: any[]) => mocks.getTermsOfServicePdfUrl(...args),
}))

vi.mock('@/lib/theme-settings', () => ({
  getThemeSiteSettingsFormState: (...args: any[]) => mocks.getThemeSiteSettingsFormState(...args),
  loadRuntimeThemeState: (...args: any[]) => mocks.loadRuntimeThemeState(...args),
}))

describe('termsOfUsePage', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset()
    mocks.getTermsOfServicePdfUrl.mockReset()
    mocks.getThemeSiteSettingsFormState.mockReset()
    mocks.loadRuntimeThemeState.mockReset()
    mocks.setRequestLocale.mockReset()

    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.getThemeSiteSettingsFormState.mockReturnValue({ siteName: 'Kuest' })
    mocks.loadRuntimeThemeState.mockResolvedValue({ site: { name: 'Kuest' } })
  })

  it('renders the uploaded PDF instead of the built-in content when configured', async () => {
    mocks.getTermsOfServicePdfUrl.mockReturnValue('https://cdn.example.com/legal/tos.pdf')

    const { default: TermsOfUsePage } = await import('@/app/[locale]/(platform)/tos/page')
    render(await TermsOfUsePage({ params: Promise.resolve({ locale: 'en' }) } as any))

    expect(screen.getByTitle('Terms of Use PDF')).toHaveAttribute(
      'src',
      'https://cdn.example.com/legal/tos.pdf#view=FitH&zoom=page-width&pagemode=none',
    )
    expect(screen.queryByText(/These Terms of Use \("Terms"\) govern your access/i)).not.toBeInTheDocument()
  })

  it('falls back to the built-in Terms of Use content when no PDF is configured', async () => {
    mocks.getTermsOfServicePdfUrl.mockReturnValue('')

    const { default: TermsOfUsePage } = await import('@/app/[locale]/(platform)/tos/page')
    render(await TermsOfUsePage({ params: Promise.resolve({ locale: 'en' }) } as any))

    expect(screen.getByText(/These Terms of Use \("Terms"\) govern your access/i)).toBeInTheDocument()
    expect(screen.queryByTitle('Terms of Use PDF')).not.toBeInTheDocument()
  })
})
