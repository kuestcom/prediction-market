import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import { describe, expect, it } from 'vitest'
import {
  applyEventCreationTemplate,
  buildDefaultDeployAt,
  buildEventCreationTimestampSeed,
  buildEventCreationWalletTail,
  buildScheduledRecurringDeployAt,
  expandEventCreationOccurrences,
  hasEventCreationDateTemplateVariable,
  normalizeEventCreationAssetPayload,
} from '@/lib/event-creation'
import { parseEventCreationSignerPrivateKeys } from '@/lib/event-creation-signers'
import {
  assertSuccessfulTransactionReceipt,
  buildEventCreationPreparePayload,
  computeNextRecurringSchedule,
} from '@/lib/event-creation-worker'

function buildLocalDateTimeValue(year: number, monthIndex: number, day: number, hour = 12, minute = 0) {
  const normalizedMonth = (monthIndex + 1).toString().padStart(2, '0')
  const normalizedDay = day.toString().padStart(2, '0')
  const normalizedHour = hour.toString().padStart(2, '0')
  const normalizedMinute = minute.toString().padStart(2, '0')

  return `${year}-${normalizedMonth}-${normalizedDay}T${normalizedHour}:${normalizedMinute}`
}

function expectLocalDateTimeParts(
  value: string | Date,
  expected: {
    year: number
    monthIndex: number
    day: number
    hour?: number
    minute?: number
  },
) {
  const date = typeof value === 'string' ? new Date(value) : value

  expect(date.getFullYear()).toBe(expected.year)
  expect(date.getMonth()).toBe(expected.monthIndex)
  expect(date.getDate()).toBe(expected.day)
  expect(date.getHours()).toBe(expected.hour ?? 12)
  expect(date.getMinutes()).toBe(expected.minute ?? 0)
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
    startAt: buildLocalDateTimeValue(2026, 2, 22, 12),
    deployAt: buildLocalDateTimeValue(2026, 2, 21, 12),
    recurrenceUnit: 'month',
    recurrenceInterval: 1,
    recurrenceUntil: buildLocalDateTimeValue(2026, 5, 30, 23, 59),
    walletAddress: '0x1111111111111111111111111111111111111111',
    updatedAt: buildLocalDateTimeValue(2026, 2, 22, 10),
    endDate: buildLocalDateTimeValue(2026, 2, 22, 12),
    mainCategorySlug: 'crypto',
    categorySlugs: ['bitcoin', 'price-action', 'macro', 'march'],
    marketMode: 'binary',
    binaryQuestion: 'BTC will rise?',
    binaryOutcomeYes: 'Yes',
    binaryOutcomeNo: 'No',
    resolutionSource: 'https://example.com',
    resolutionRules: 'Resolve YES if BTC closes above the opening price on {{date}} {{year}}.',
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
        resolutionRules: 'Resolve YES if BTC closes above the opening price on {{date}} {{year}}.',
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
      startAt: buildLocalDateTimeValue(2026, 2, 22, 12),
      status: 'scheduled',
      creationMode: 'recurring',
      recurrenceUnit: 'month',
      recurrenceInterval: 1,
      recurrenceUntil: buildLocalDateTimeValue(2026, 4, 31, 23, 59),
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
    const occurrenceDate = new Date(buildLocalDateTimeValue(2026, 2, 22, 12))
    const expectedSuffix = `${buildEventCreationTimestampSeed(occurrenceDate)}${buildEventCreationWalletTail('0x1111111111111111111111111111111111111111')}`
    const result = buildEventCreationPreparePayload({
      record: buildDraft(),
      creator: '0x1111111111111111111111111111111111111111',
      chainId: 80002,
    })

    expect(result.payload.title).toBe('BTC will rise on 22 March?')
    expect(result.payload.slug).toBe(`btc-will-rise-22-march-${expectedSuffix}`)
    expect(result.payload.resolutionRules).toBe('Resolve YES if BTC closes above the opening price on 22 March 2026.')
    expectLocalDateTimeParts(result.payload.endDateIso, { year: 2026, monthIndex: 2, day: 22, hour: 12 })
    expect(result.payload.binaryOutcomeYes).toBe('Yes')
  })

  it('supports day offsets in recurring template variables', () => {
    const occurrenceDate = new Date(buildLocalDateTimeValue(2026, 2, 22, 12))
    const result = applyEventCreationTemplate(
      'From {{date-7}} 12:00 PM ET to {{date}} {{year}} 12:00 PM ET.',
      occurrenceDate,
    )

    expect(result).toBe('From 15 March 12:00 PM ET to 22 March 2026 12:00 PM ET.')
  })

  it('detects date-based recurring template variables including offsets', () => {
    expect(hasEventCreationDateTemplateVariable('BTC on {{date}}')).toBe(true)
    expect(hasEventCreationDateTemplateVariable('BTC from {{date-7}} to {{date}}')).toBe(true)
    expect(hasEventCreationDateTemplateVariable('Static recurring title')).toBe(false)
  })

  it('computes the next recurring schedule and deploy window', () => {
    const next = computeNextRecurringSchedule(buildDraft())

    expect(next).not.toBeNull()
    expectLocalDateTimeParts(next!.nextStartAt, { year: 2026, monthIndex: 3, day: 22, hour: 12 })
    expectLocalDateTimeParts(next!.nextDeployAt!, { year: 2026, monthIndex: 2, day: 21, hour: 12 })
  })

  it('derives future recurring deploy windows from the resolution date and cadence', () => {
    const deployAt = buildScheduledRecurringDeployAt(
      new Date(buildLocalDateTimeValue(2026, 4, 10, 12)),
      'month',
      1,
    )

    expect(deployAt).not.toBeNull()
    expectLocalDateTimeParts(deployAt!, { year: 2026, monthIndex: 3, day: 9, hour: 12 })
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
