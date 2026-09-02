import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Event } from '@/types'

import { useEventVolumes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventVolumes'

const mocks = vi.hoisted(() => ({
  clobUrl: 'https://clob.example',
  fetch: vi.fn(),
}))

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ clobUrl: mocks.clobUrl }),
}))

interface VolumeRequestCondition {
  condition_id: string
  token_ids: [string, string]
}

function createEvent(conditionCount: number): Event {
  return {
    id: 'event-1',
    markets: Array.from({ length: conditionCount }, (_, index) => ({
      condition_id: `condition-${index}`,
      volume: 100 + index,
      outcomes: [{ token_id: `yes-token-${index}` }, { token_id: `no-token-${index}` }],
    })),
  } as unknown as Event
}

function createResponse(payload: unknown, options: { ok?: boolean; status?: number } = {}) {
  const ok = options.ok ?? true
  return {
    ok,
    status: options.status ?? (ok ? 200 : 500),
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

function parseRequestConditions(init: RequestInit | undefined): VolumeRequestCondition[] {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected a JSON request body.')
  }

  return JSON.parse(init.body).conditions as VolumeRequestCondition[]
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderEventVolumes(event: Event) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })

  return renderHook(() => useEventVolumes(event), {
    wrapper: createWrapper(queryClient),
  })
}

describe('useEventVolumes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads all chunks successfully and respects the 100-condition request limit', async () => {
    const event = createEvent(101)
    mocks.fetch.mockImplementation(async (_input: string, init: RequestInit) => {
      const conditions = parseRequestConditions(init)
      return createResponse(conditions.map(({ condition_id }) => ({ condition_id, status: 200, volume: '1' })))
    })

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.totalVolume).toBe(101))

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls.map(([, init]) => parseRequestConditions(init).length)).toEqual([100, 1])
    expect(Object.keys(result.current.volumeByCondition)).toHaveLength(101)
  })

  it.each([
    ['a network error', () => Promise.reject(new Error('Network error'))],
    ['a non-successful HTTP response', () => Promise.resolve(createResponse([], { ok: false, status: 503 }))],
    ['an empty response payload', () => Promise.resolve(createResponse([]))],
    [
      'invalid JSON',
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.reject(new Error('Invalid JSON')),
        }),
    ],
    ['a malformed response shape', () => Promise.resolve(createResponse({ data: [] }))],
  ])('preserves successful chunks when another chunk fails because of %s', async (_description, failedChunk) => {
    const event = createEvent(101)
    mocks.fetch.mockImplementation(async (_input: string, init: RequestInit) => {
      const conditions = parseRequestConditions(init)
      if (conditions.length === 1) {
        return failedChunk()
      }

      return createResponse(conditions.map(({ condition_id }) => ({ condition_id, status: 200, volume: '2' })))
    })

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(Object.keys(result.current.volumeByCondition)).toHaveLength(100))

    expect(result.current.totalVolume).toBeNull()
    expect(result.current.volumeByCondition['condition-0']).toBe(2)
    expect(result.current.volumeByCondition['condition-100']).toBeUndefined()
  })

  it('keeps successful values from a 207 response but does not expose a partial total', async () => {
    const event = createEvent(2)
    mocks.fetch.mockResolvedValue(
      createResponse(
        [
          { condition_id: 'condition-0', status: 200, volume: '12.5' },
          { condition_id: 'condition-1', status: 500 },
        ],
        { status: 207 },
      ),
    )

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.volumeByCondition['condition-0']).toBe(12.5))

    expect(result.current.volumeByCondition['condition-1']).toBeUndefined()
    expect(result.current.totalVolume).toBeNull()
  })

  it('does not treat a response missing a requested condition as complete', async () => {
    const event = createEvent(2)
    mocks.fetch.mockResolvedValue(createResponse([{ condition_id: 'condition-0', status: 200, volume: '8' }]))

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.volumeByCondition['condition-0']).toBe(8))

    expect(result.current.volumeByCondition['condition-1']).toBeUndefined()
    expect(result.current.totalVolume).toBeNull()
  })

  it('ignores malformed entries for conditions that were not requested', async () => {
    const event = createEvent(2)
    mocks.fetch.mockResolvedValue(
      createResponse([
        { condition_id: 'condition-0', status: 200, volume: '3' },
        { condition_id: 'condition-1', status: 200, volume: '4' },
        { condition_id: 'unrequested-condition', status: 'invalid' },
      ]),
    )

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.totalVolume).toBe(7))

    expect(result.current.volumeByCondition).toEqual({ 'condition-0': 3, 'condition-1': 4 })
  })

  it('ignores a malformed duplicate after a requested condition already has a valid volume', async () => {
    const event = createEvent(2)
    mocks.fetch.mockResolvedValue(
      createResponse([
        { condition_id: 'condition-0', status: 200, volume: '3' },
        { condition_id: 'condition-1', status: 200, volume: '4' },
        { condition_id: 'condition-0', status: 200, volume: 'not-a-number' },
      ]),
    )

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.totalVolume).toBe(7))

    expect(result.current.volumeByCondition).toEqual({ 'condition-0': 3, 'condition-1': 4 })
  })

  it('exposes a complete total when every requested volume is legitimately zero', async () => {
    const event = createEvent(2)
    mocks.fetch.mockResolvedValue(
      createResponse([
        { condition_id: 'condition-0', status: 200, volume: '0' },
        { condition_id: 'condition-1', status: 200, volume: '0' },
      ]),
    )

    const { result } = renderEventVolumes(event)

    await waitFor(() => expect(result.current.totalVolume).toBe(0))

    expect(result.current.volumeByCondition).toEqual({ 'condition-0': 0, 'condition-1': 0 })
  })
})
