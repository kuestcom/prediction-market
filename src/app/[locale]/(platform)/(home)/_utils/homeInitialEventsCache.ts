export const HOME_INITIAL_EVENTS_CACHE_LIFE = {
  stale: 60,
  revalidate: 60,
  expire: 900,
} as const

const HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS = 60_000

export function getHomeInitialCurrentTimestamp() {
  return Math.floor(Date.now() / HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS) * HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS
}
