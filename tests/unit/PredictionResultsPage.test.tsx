import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  notFound: mock(),
  renderPredictionResultsPage: mock(),
  setRequestLocale: mock(),
}))

void mock.module('next-intl/server', () => ({
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

void mock.module('next/navigation', () => ({
  notFound: (...args: any[]) => mocks.notFound(...args),
}))

void mock.module('@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page', () => ({
  generatePredictionResultsMetadata: mock(),
  renderPredictionResultsPage: (...args: any[]) => mocks.renderPredictionResultsPage(...args),
}))

void mock.module('@/lib/static-params', () => ({
  getPublicShellStaticParams: mock(),
  shouldBypassPublicShellPlaceholder: mock(() => false),
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
    const { default: PredictionResultsPage } = await import('@/app/[locale]/(platform)/predictions/[slug]/page')

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
