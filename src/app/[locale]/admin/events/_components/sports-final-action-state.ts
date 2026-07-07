import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { normalizeSingleSportsSourceProvider } from '@/lib/sports-source/providers'

export function shouldHighlightSportsFinalAction(event: Pick<
  AdminEventRow,
  'sports_ended' | 'sports_source_event_id' | 'sports_source_game_id' | 'sports_source_provider'
>) {
  if (event.sports_ended) {
    return true
  }

  const provider = normalizeSingleSportsSourceProvider(event.sports_source_provider)
  if (!provider) {
    return false
  }

  return Boolean(event.sports_source_event_id?.trim() || event.sports_source_game_id?.trim())
}
