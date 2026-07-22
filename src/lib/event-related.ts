import type { HomeVisibleEventCandidate } from '@/lib/home-events'
import { filterHomeEvents } from '@/lib/home-events'

interface SelectRelatedEventCandidatesOptions {
  currentTimestamp: number
  limit: number
}

export function selectRelatedEventCandidates<T extends HomeVisibleEventCandidate>(
  candidates: T[],
  options: SelectRelatedEventCandidatesOptions,
) {
  const activeCandidates = candidates.filter(candidate => candidate.status === 'active')

  return filterHomeEvents(activeCandidates, {
    currentTimestamp: options.currentTimestamp,
    status: 'active',
  }).slice(0, options.limit)
}
