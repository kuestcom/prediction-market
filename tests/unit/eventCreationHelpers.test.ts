import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import { describe, expect, it } from 'vitest'
import { buildDefaultDeployAt, expandEventCreationOccurrences, normalizeEventCreationAssetPayload } from '@/lib/event-creation'
import { parseEventCreationSignerPrivateKeys } from '@/lib/event-creation-signers'
import {
  assertSuccessfulTransactionReceipt,
  buildEventCreationPreparePayload,
  computeNextRecurringSchedule,
} from '@/lib/event-creation-worker'

function buildLocalIsoDate(year: number, monthIndex: number, day: number, hour = 12, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString()
}

function buildDraft(overrides: Partial<EventCreationDraftRecord> = {}): EventCreationDraftRecord {
  return {
    id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
    title: 'BTC will rise?',
    slug: 'btc-will-rise',
    titleTemplate: 'BTC will rise on {{day}} {{month_name}}?',
    slugTemplate: 'btc-will-rise-{{day_padded}}-{{month_name_lower}}',
    creationMode: 'recurring',
    status: 'scheduled',
    startAt: buildLocalIsoDate(2026, 2, 22, 12),
    deployAt: buildLocalIsoDate(2026, 2, 21, 12),
    recurrenceUnit: 'month',
    recurrenceInterval: 1,
    recurrenceUntil: buildLocalIsoDate(2026, 5, 30, 23, 59),
    walletAddress: '0x1111111111111111111111111111111111111111',
    updatedAt: buildLocalIsoDate(2026, 2, 22, 10),
    endDate: buildLocalIsoDate(2026, 2, 22, 12),
    mainCategorySlug: 'crypto',
    categorySlugs: ['bitcoin', 'price-action', 'macro', 'march'],
    marketMode: 'binary',
    binaryQuestion: 'BTC will rise?',
    binaryOutcomeYes: 'Yes',
    binaryOutcomeNo: 'No',
    resolutionSource: 'https://example.com',
    resolutionRules: 'Resolve YES if BTC closes above the opening price.',
    draftPayload: {
      form: {
        title: 'BTC will rise?',
        slug: 'btc-will-rise',
        endDateIso: '2026-03-22T12:00',
        mainCategorySlug: 'crypto',
        categories: [
          { label: 'Bitcoin', slug: 'bitcoin' },
          { label: 'Price Action', slug: 'price-action' },
          { label: 'Macro', slug: 'macro' },
          { label: 'March', slug: 'march' },
        ],
        marketMode: 'binary',
        binaryOutcomeYes: 'Yes',
        binaryOutcomeNo: 'No',
        resolutionSource: 'https://example.com',
        resolutionRules: 'Resolve YES if BTC closes above the opening price.',
      },
    },
    assetPayload: {
      eventImage: null,
      optionImages: {},
      teamLogos: {},
    },
    pendingRequestId: null,
    pendingPayloadHash: null,
    pendingChainId: null,
    pendingConfirmedTxs: [],
    ...overrides,
  }
}

describe('event creation helpers', () => {
  it('expands recurring calendar occurrences with title templates', () => {
    const occurrences = expandEventCreationOccurrences({
      id: 'draft-1',
      title: 'BTC will rise?',
      slug: 'btc-will-rise',
      titleTemplate: 'BTC will rise on {{day}} {{month_name}}?',
      slugTemplate: 'btc-will-rise-{{day_padded}}-{{month_name_lower}}',
      startAt: buildLocalIsoDate(2026, 2, 22, 12),
      status: 'scheduled',
      creationMode: 'recurring',
      recurrenceUnit: 'month',
      recurrenceInterval: 1,
      recurrenceUntil: buildLocalIsoDate(2026, 4, 31, 23, 59),
      maxOccurrences: 4,
    })

    expect(occurrences).toHaveLength(3)
    expect(occurrences[0]?.title).toBe('BTC will rise on 22 March?')
    expect(occurrences[1]?.title).toBe('BTC will rise on 22 April?')
    expect(occurrences[2]?.title).toBe('BTC will rise on 22 May?')
  })

  it('parses signer private keys from env arrays and dedupes by address', () => {
    const signers = parseEventCreationSignerPrivateKeys(JSON.stringify([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]))

    expect(signers).toHaveLength(1)
    expect(signers[0]?.address).toMatch(/^0x[a-f0-9]{40}$/)
  })

  it('builds recurring prepare payloads using the scheduled occurrence date', () => {
    const result = buildEventCreationPreparePayload({
      record: buildDraft(),
      creator: '0x1111111111111111111111111111111111111111',
      chainId: 80002,
    })

    expect(result.payload.title).toBe('BTC will rise on 22 March?')
    expect(result.payload.slug).toBe('btc-will-rise-22-march')
    expect(result.payload.endDateIso).toBe(buildLocalIsoDate(2026, 2, 22, 12))
    expect(result.payload.binaryOutcomeYes).toBe('Yes')
  })

  it('computes the next recurring schedule and deploy window', () => {
    const next = computeNextRecurringSchedule(buildDraft())

    expect(next?.nextStartAt.toISOString()).toBe(buildLocalIsoDate(2026, 3, 22, 12))
    expect(next?.nextDeployAt?.toISOString()).toBe(buildLocalIsoDate(2026, 3, 21, 12))
  })

  it('subtracts an exact 24 hours for default deploy timestamps', () => {
    const startAt = new Date('2026-11-01T05:30:00.000Z')

    expect(buildDefaultDeployAt(startAt)?.toISOString()).toBe('2026-10-31T05:30:00.000Z')
  })

  it('filters dangerous asset record keys during normalization', () => {
    const normalized = normalizeEventCreationAssetPayload({
      optionImages: {
        valid_key: {
          storagePath: 'event-creations/draft-1/valid.png',
          publicUrl: 'https://example.com/valid.png',
          fileName: 'valid.png',
          contentType: 'image/png',
        },
        __proto__: {
          storagePath: 'event-creations/draft-1/bad.png',
          publicUrl: 'https://example.com/bad.png',
          fileName: 'bad.png',
          contentType: 'image/png',
        },
      },
    })

    expect(normalized.optionImages.valid_key?.fileName).toBe('valid.png')
    expect(Object.keys(normalized.optionImages)).toEqual(['valid_key'])
  })

  it('throws when a transaction receipt is reverted', () => {
    expect(() => assertSuccessfulTransactionReceipt({
      status: 'reverted',
      transactionHash: '0x1234',
    } as any, '0x1234')).toThrow('Transaction reverted: 0x1234')
  })
})
