import type { Event, Market, Outcome } from '@/types'
import { describe, expect, it } from 'vitest'
import { resolveEventOrderBootstrapSelection } from '@/app/[locale]/(platform)/event/[slug]/_utils/event-order-bootstrap-selection'
import { OUTCOME_INDEX } from '@/lib/constants'

function createOutcome(
  conditionId: string,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
  tokenId: string,
  label: string,
) {
  return {
    condition_id: conditionId,
    outcome_index: outcomeIndex,
    outcome_text: label,
    token_id: tokenId,
  } as Outcome
}

function createMarket(conditionId: string, slug: string, outcomes: Outcome[]) {
  return {
    condition_id: conditionId,
    slug,
    outcomes,
  } as Market
}

function createEvent(markets: Market[]) {
  return {
    id: 'event-1',
    markets,
  } as Event
}

describe('resolveEventOrderBootstrapSelection', () => {
  it('preserves an already-synced outcome for the target market', () => {
    const yesOutcome = createOutcome('cond-1', OUTCOME_INDEX.YES, 'token-yes', 'Yes')
    const noOutcome = createOutcome('cond-1', OUTCOME_INDEX.NO, 'token-no', 'No')
    const market = createMarket('cond-1', 'winner', [yesOutcome, noOutcome])
    const event = createEvent([market])

    const selection = resolveEventOrderBootstrapSelection({
      event,
      targetMarket: market,
      preserveSnapshotMarket: true,
      snapshot: {
        eventId: event.id,
        market,
        outcome: noOutcome,
      },
    })

    expect(selection.market).toBe(market)
    expect(selection.outcome).toBe(noOutcome)
  })

  it('preserves a store-selected market for the current event', () => {
    const marketOneYes = createOutcome('cond-1', OUTCOME_INDEX.YES, 'token-1-yes', 'Yes')
    const marketOneNo = createOutcome('cond-1', OUTCOME_INDEX.NO, 'token-1-no', 'No')
    const marketTwoYes = createOutcome('cond-2', OUTCOME_INDEX.YES, 'token-2-yes', 'Over')
    const marketTwoNo = createOutcome('cond-2', OUTCOME_INDEX.NO, 'token-2-no', 'Under')
    const defaultMarket = createMarket('cond-1', 'winner', [marketOneYes, marketOneNo])
    const selectedMarket = createMarket('cond-2', 'total', [marketTwoYes, marketTwoNo])
    const event = createEvent([defaultMarket, selectedMarket])

    const selection = resolveEventOrderBootstrapSelection({
      event,
      targetMarket: defaultMarket,
      preserveSnapshotMarket: true,
      snapshot: {
        eventId: event.id,
        market: selectedMarket,
        outcome: marketTwoNo,
      },
    })

    expect(selection.market).toBe(selectedMarket)
    expect(selection.outcome).toBe(marketTwoNo)
  })

  it('falls back to the market default outcome when the store selection does not match', () => {
    const yesOutcome = createOutcome('cond-1', OUTCOME_INDEX.YES, 'token-yes', 'Yes')
    const noOutcome = createOutcome('cond-1', OUTCOME_INDEX.NO, 'token-no', 'No')
    const unrelatedOutcome = createOutcome('cond-2', OUTCOME_INDEX.NO, 'token-other', 'Other')
    const market = createMarket('cond-1', 'winner', [yesOutcome, noOutcome])
    const event = createEvent([market])

    const selection = resolveEventOrderBootstrapSelection({
      event,
      targetMarket: market,
      preserveSnapshotMarket: true,
      snapshot: {
        eventId: event.id,
        market,
        outcome: unrelatedOutcome,
      },
    })

    expect(selection.market).toBe(market)
    expect(selection.outcome).toBe(yesOutcome)
  })

  it('keeps the route-selected market when snapshot market preservation is disabled', () => {
    const marketOneYes = createOutcome('cond-1', OUTCOME_INDEX.YES, 'token-1-yes', 'Yes')
    const marketOneNo = createOutcome('cond-1', OUTCOME_INDEX.NO, 'token-1-no', 'No')
    const marketTwoYes = createOutcome('cond-2', OUTCOME_INDEX.YES, 'token-2-yes', 'Over')
    const marketTwoNo = createOutcome('cond-2', OUTCOME_INDEX.NO, 'token-2-no', 'Under')
    const targetMarket = createMarket('cond-1', 'winner', [marketOneYes, marketOneNo])
    const snapshotMarket = createMarket('cond-2', 'total', [marketTwoYes, marketTwoNo])
    const event = createEvent([targetMarket, snapshotMarket])

    const selection = resolveEventOrderBootstrapSelection({
      event,
      targetMarket,
      preserveSnapshotMarket: false,
      snapshot: {
        eventId: event.id,
        market: snapshotMarket,
        outcome: marketTwoNo,
      },
    })

    expect(selection.market).toBe(targetMarket)
    expect(selection.outcome).toBe(marketOneYes)
  })
})
