import type { Event } from '@/types'

export function mergeUniqueEventsById(...collections: Array<Event[] | null | undefined>) {
  const merged: Event[] = []
  const seenIds = new Set<string>()

  for (const collection of collections) {
    for (const event of collection ?? []) {
      if (!event?.id || seenIds.has(event.id)) {
        continue
      }

      seenIds.add(event.id)
      merged.push(event)
    }
  }

  return merged
}
