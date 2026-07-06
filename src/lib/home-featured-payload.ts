import type { HomeFeaturedContextItem, HomeFeaturedEventAdminItem } from '@/types'

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function serializeContextItemsForSave(items: HomeFeaturedContextItem[] | null | undefined, locale: string) {
  return (items ?? []).map(contextItem => ({
    id: contextItem.id,
    type: contextItem.type,
    source: contextItem.source,
    title: contextItem.title,
    avatarUrl: contextItem.avatarUrl,
    faviconUrl: contextItem.faviconUrl,
    url: contextItem.url,
    publishedAt: contextItem.publishedAt,
    selectedAt: contextItem.selectedAt,
    expiresAt: contextItem.expiresAt,
    relevanceScore: contextItem.relevanceScore,
    isManual: contextItem.isManual,
    locale,
  }))
}

export function serializeHomeFeaturedEventsForSave(items: HomeFeaturedEventAdminItem[], locale: string) {
  return items.map((event, index) => {
    const eventId = normalizeOptionalString(event.eventId)
    const seriesSlug = normalizeOptionalString(event.seriesSlug)

    return {
      targetType: event.targetType,
      eventId,
      seriesSlug,
      enabled: event.enabled,
      rank: index,
      source: event.source,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      contextMode: event.contextMode,
      autoRolloverEnabled: event.autoRolloverEnabled,
      contextLocale: locale,
      contextEventId: eventId,
      contextItems: serializeContextItemsForSave(event.contextItems, locale),
    }
  })
}
