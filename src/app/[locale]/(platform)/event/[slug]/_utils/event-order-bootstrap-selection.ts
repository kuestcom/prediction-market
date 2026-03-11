import type { Event, Market, Outcome } from '@/types'

interface EventOrderStoreSnapshot {
  eventId?: string | null
  market?: Market | null
  outcome?: Outcome | null
}

interface EventOrderBootstrapSelectionOptions {
  event: Event
  targetMarket: Market
  snapshot: EventOrderStoreSnapshot
  preserveSnapshotMarket: boolean
}

export function resolveEventOrderBootstrapSelection({
  event,
  targetMarket,
  snapshot,
  preserveSnapshotMarket,
}: EventOrderBootstrapSelectionOptions) {
  const storeMarket = preserveSnapshotMarket && snapshot.eventId === event.id && snapshot.market
    ? event.markets.find(market => market.condition_id === snapshot.market?.condition_id) ?? null
    : null
  const market = storeMarket ?? targetMarket
  const storeOutcome = snapshot.eventId === event.id && snapshot.outcome?.condition_id === market.condition_id
    ? market.outcomes.find(outcome => outcome.token_id === snapshot.outcome?.token_id)
    ?? market.outcomes.find(outcome => outcome.outcome_index === snapshot.outcome?.outcome_index)
    ?? null
    : null

  return {
    market,
    outcome: storeOutcome ?? market.outcomes[0] ?? null,
  }
}
