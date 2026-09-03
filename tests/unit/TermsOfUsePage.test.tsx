import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getTranslations: vi.fn(),
  getThemeSiteSettingsFormState: vi.fn(),
  loadRuntimeThemeState: vi.fn(),
  setRequestLocale: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getExtracted: () => (value: string) => value,
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/db/queries/terms-of-service', () => ({
  TermsOfServiceRepository: {
    getTranslations: (...args: any[]) => mocks.getTranslations(...args),
  },
}))

vi.mock('@/lib/theme-settings', () => ({
  getThemeSiteSettingsFormState: (...args: any[]) => mocks.getThemeSiteSettingsFormState(...args),
  loadRuntimeThemeState: (...args: any[]) => mocks.loadRuntimeThemeState(...args),
}))

describe('termsOfUsePage', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset()
    mocks.getTranslations.mockReset()
    mocks.getThemeSiteSettingsFormState.mockReset()
    mocks.loadRuntimeThemeState.mockReset()
    mocks.setRequestLocale.mockReset()

    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.getTranslations.mockResolvedValue({
      data: {
        en: '# Kuest Terms of Use\n\nEnglish content.',
        de: '',
        es: '',
        pt: '# Termos de Uso da Kuest\n\nConteúdo em português.',
        fr: '',
        zh: '',
        ja: '',
        ar: '',
        ru: '',
        it: '',
        pl: '',
        ko: '',
      },
      error: null,
    })
    mocks.getThemeSiteSettingsFormState.mockReturnValue({ siteName: 'Kuest' })
    mocks.loadRuntimeThemeState.mockResolvedValue({ site: { name: 'Kuest' } })
  })

  it('renders the saved Terms of Use content for the requested locale', async () => {
    const { default: TermsOfUsePage } = await import('@/app/[locale]/(platform)/tos/page')
    render(await TermsOfUsePage({ params: Promise.resolve({ locale: 'en' }) } as any))

    expect(screen.getByRole('heading', { name: 'Kuest Terms of Use' })).toBeInTheDocument()
    expect(screen.getByText('English content.')).toBeInTheDocument()
  })

  it('renders the translated Terms of Use content for a non-English locale', async () => {
    const { default: TermsOfUsePage } = await import('@/app/[locale]/(platform)/tos/page')
    render(await TermsOfUsePage({ params: Promise.resolve({ locale: 'pt' }) } as any))

    expect(screen.getByRole('heading', { name: 'Termos de Uso da Kuest' })).toBeInTheDocument()
    expect(screen.getByText('Conteúdo em português.')).toBeInTheDocument()
  })

  it('renders an explicit unavailable state when Terms of Use content cannot be loaded', async () => {
    mocks.getTranslations.mockResolvedValueOnce({ data: null, error: 'Failed to fetch Terms of Use translations.' })

    const { default: TermsOfUsePage } = await import('@/app/[locale]/(platform)/tos/page')
    render(await TermsOfUsePage({ params: Promise.resolve({ locale: 'en' }) } as any))

    expect(screen.getByRole('alert')).toHaveTextContent('Terms of Use content is temporarily unavailable.')
  })
})
