import { describe, expect, it } from 'vitest'
import {
  buildPredictionResultsUrlSearchParams,
  parsePredictionResultsSort,
  parsePredictionResultsStatus,
  resolvePredictionResultsApiSort,
  resolvePredictionResultsFiltersFromSearchParams,
  resolvePredictionResultsRequestedApiSort,
} from '@/lib/prediction-results-filters'
import {
  buildPredictionResultsPath,
  resolvePredictionSearchContext,
} from '@/lib/prediction-search'

const navigationTags = [
  {
    slug: 'politics',
    name: 'Politics',
    childs: [
      { slug: 'brazil', name: 'Brazil' },
    ],
  },
  {
    slug: 'science',
    name: 'Science',
    childs: [
      { slug: 'space', name: 'Space' },
    ],
  },
] as const

describe('prediction search helpers', () => {
  it('builds a predictions route path from free-text input', () => {
    expect(buildPredictionResultsPath('Future Bets')).toBe('/predictions/future-bets')
  })

  it('resolves main-category slugs to tag contexts', () => {
    expect(resolvePredictionSearchContext(navigationTags as any, 'politics')).toMatchObject({
      kind: 'main-tag',
      label: 'Politics',
      mainTag: 'politics',
      query: '',
      tag: 'politics',
    })
  })

  it('resolves child-category slugs to their parent tag context', () => {
    expect(resolvePredictionSearchContext(navigationTags as any, 'brazil')).toMatchObject({
      kind: 'child-tag',
      label: 'Brazil',
      mainTag: 'politics',
      query: '',
      tag: 'brazil',
    })
  })

  it('falls back to free-text prediction queries for unmatched slugs', () => {
    expect(resolvePredictionSearchContext(navigationTags as any, 'us-nuclear-test')).toMatchObject({
      kind: 'query',
      label: 'Us Nuclear Test',
      mainTag: 'trending',
      query: 'us nuclear test',
      tag: 'trending',
    })
  })

  it('parses supported sort and status params while defaulting invalid values', () => {
    expect(parsePredictionResultsSort('competitive')).toBe('trending')
    expect(parsePredictionResultsSort('random')).toBe('trending')
    expect(parsePredictionResultsStatus('all')).toBe('all')
    expect(parsePredictionResultsStatus('resolved')).toBe('resolved')
    expect(parsePredictionResultsStatus('archived')).toBe('active')
  })

  it('preserves unrelated params when writing prediction result filters', () => {
    const params = buildPredictionResultsUrlSearchParams(
      new URLSearchParams('foo=bar'),
      { sort: 'volume', status: 'resolved' },
    )

    expect(params.toString()).toBe('foo=bar&_sort=volume&_status=resolved')
  })

  it('omits default prediction filters from the url', () => {
    const params = buildPredictionResultsUrlSearchParams(
      new URLSearchParams('foo=bar&_sort=trending&_status=active'),
      { sort: 'trending', status: 'active' },
    )

    expect(params.toString()).toBe('foo=bar')
  })

  it('resolves prediction result filters from route search params', () => {
    expect(resolvePredictionResultsFiltersFromSearchParams({
      foo: 'bar',
      _sort: 'competitive',
      _status: 'resolved',
    })).toEqual({
      sort: 'trending',
      status: 'resolved',
    })
  })

  it('maps prediction sorts to API sorts', () => {
    expect(resolvePredictionResultsApiSort('trending')).toBe('trending')
    expect(resolvePredictionResultsApiSort('newest')).toBe('created_at')
    expect(resolvePredictionResultsApiSort('ending-soon')).toBe('end_date')
  })

  it('uses search ordering for free-text queries on the default trending sort', () => {
    expect(resolvePredictionResultsRequestedApiSort({
      query: 'meta',
      sort: 'trending',
    })).toBeUndefined()

    expect(resolvePredictionResultsRequestedApiSort({
      query: '',
      sort: 'trending',
    })).toBe('trending')

    expect(resolvePredictionResultsRequestedApiSort({
      query: 'meta',
      sort: 'volume',
    })).toBe('volume')
  })
})
