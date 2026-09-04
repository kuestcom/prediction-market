import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  generatePredictionResultsMetadata: mock(),
  renderPredictionResultsPage: mock(),
  setRequestLocale: mock(),
  translate: mock((value: string) => value),
}))

void mock.module('next-intl/server', () => ({
  getExtracted: mock(async () => mocks.translate),
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

void mock.module('@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page', () => ({
  generatePredictionResultsMetadata: (...args: any[]) => mocks.generatePredictionResultsMetadata(...args),
  renderPredictionResultsPage: (...args: any[]) => mocks.renderPredictionResultsPage(...args),
}))

describe('popular predictions page', () => {
  beforeEach(() => {
    mocks.generatePredictionResultsMetadata.mockReset()
    mocks.renderPredictionResultsPage.mockReset()
    mocks.setRequestLocale.mockReset()
    mocks.translate.mockClear()
    mocks.renderPredictionResultsPage.mockResolvedValue(null)
  })

  it('server-renders popular events with the requested filters', async () => {
    const { default: PopularPredictionsPage } = await import('@/app/[locale]/(platform)/predictions/page')

    await PopularPredictionsPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({
        _sort: 'volume',
        _status: 'resolved',
      }),
    })

    expect(mocks.renderPredictionResultsPage).toHaveBeenCalledWith({
      heading: 'Explore popular predictions & real-time odds',
      initialSort: 'volume',
      initialStatus: 'resolved',
      locale: 'en',
      slug: 'trending',
    })
  })

  it('translates metadata copy', async () => {
    const { generateMetadata } = await import('@/app/[locale]/(platform)/predictions/page')

    await generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    })

    expect(mocks.translate).toHaveBeenCalledWith('Explore popular predictions & real-time odds')
    expect(mocks.translate).toHaveBeenCalledWith(
      'Explore popular prediction markets with live prices and real-time odds.',
    )
    expect(mocks.generatePredictionResultsMetadata).toHaveBeenCalledWith({
      description: 'Explore popular prediction markets with live prices and real-time odds.',
      locale: 'en',
      pageSlug: null,
      slug: 'trending',
      title: 'Explore popular predictions & real-time odds',
    })
  })
})
