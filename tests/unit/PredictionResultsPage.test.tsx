import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  renderPredictionResultsPage: vi.fn(),
  setRequestLocale: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

vi.mock('next/navigation', () => ({
  notFound: (...args: any[]) => mocks.notFound(...args),
}))

vi.mock('@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page', () => ({
  generatePredictionResultsMetadata: vi.fn(),
  renderPredictionResultsPage: (...args: any[]) => mocks.renderPredictionResultsPage(...args),
}))

vi.mock('@/lib/static-params', () => ({
  getPublicShellStaticParams: vi.fn(),
  shouldBypassPublicShellPlaceholder: vi.fn(() => false),
  STATIC_PARAMS_PLACEHOLDER: '__placeholder__',
}))

describe('prediction results page', () => {
  beforeEach(() => {
    mocks.notFound.mockReset()
    mocks.renderPredictionResultsPage.mockReset()
    mocks.setRequestLocale.mockReset()
    mocks.renderPredictionResultsPage.mockResolvedValue(null)
  })

  it('server-renders direct visits with their requested filters', async () => {
    const { default: PredictionResultsPage } = await import(
      '@/app/[locale]/(platform)/predictions/[slug]/page',
    )

    await PredictionResultsPage({
      params: Promise.resolve({ locale: 'en', slug: 'bitcoin' }),
      searchParams: Promise.resolve({
        _sort: 'volume',
        _status: 'resolved',
      }),
    })

    expect(mocks.renderPredictionResultsPage).toHaveBeenCalledWith({
      initialSort: 'volume',
      initialStatus: 'resolved',
      locale: 'en',
      slug: 'bitcoin',
    })
  })
})
