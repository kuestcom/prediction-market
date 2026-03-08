import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type { Event } from '@/types'
import { buildEventFaqItems } from '@/lib/event-faq'
import { buildEventOgImageUrl } from '@/lib/event-open-graph'
import { withLocalePrefix } from '@/lib/locale-path'
import { isDynamicHomeCategorySlug } from '@/lib/platform-routing'
import siteUrlUtils from '@/lib/site-url'
import { getThemeSiteSameAs } from '@/lib/theme-site-identity'

const { resolveSiteUrl } = siteUrlUtils

export interface StructuredDataNode {
  [key: string]: unknown
}

interface BuildSiteStructuredDataOptions {
  locale: SupportedLocale
  site: ThemeSiteIdentity
}

interface BuildEventStructuredDataOptions {
  event: Event
  locale: SupportedLocale
  pagePath: string
  site: ThemeSiteIdentity
  marketSlug?: string | null
  includeFaq?: boolean
}

interface StructuredDataBreadcrumbTarget {
  name: string
  path: string
}

const STRUCTURED_DATA_URL_PROTOCOLS = new Set(['http:', 'https:'])

function resolveAbsoluteUrl(pathOrUrl: string | null | undefined, siteUrl: string) {
  const normalized = pathOrUrl?.trim()
  if (!normalized) {
    return null
  }

  try {
    const resolvedUrl = new URL(normalized, siteUrl)

    return STRUCTURED_DATA_URL_PROTOCOLS.has(resolvedUrl.protocol)
      ? resolvedUrl.toString()
      : null
  }
  catch {
    return null
  }
}

function buildAbsolutePageUrl(path: string, locale: SupportedLocale, siteUrl: string) {
  return new URL(withLocalePrefix(path, locale), siteUrl).toString()
}

function humanizeSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((segment) => {
      if (segment.length <= 3) {
        return segment.toUpperCase()
      }

      return `${segment[0]!.toUpperCase()}${segment.slice(1)}`
    })
    .join(' ')
}

function buildEventStructuredDataDescription(eventTitle: string, siteName: string) {
  return `Live odds, market activity, and trading data for ${eventTitle} on ${siteName}.`
}

function resolveEventImageUrls(event: Event, eventOgImageUrl: string, siteUrl: string) {
  const imageUrls = [
    resolveAbsoluteUrl(eventOgImageUrl, siteUrl),
    resolveAbsoluteUrl(event.icon_url, siteUrl),
  ].filter((value): value is string => Boolean(value))

  return Array.from(new Set(imageUrls))
}

function resolveEventSchemaStatus(event: Event) {
  if (event.resolved_at || event.status === 'resolved') {
    return 'https://schema.org/EventCompleted'
  }

  if (event.status === 'archived') {
    return 'https://schema.org/EventCancelled'
  }

  return 'https://schema.org/EventScheduled'
}

function resolveOfferAvailability(event: Event) {
  return event.status === 'active'
    ? 'https://schema.org/InStock'
    : 'https://schema.org/SoldOut'
}

function resolveSelectedMarket(event: Event, marketSlug?: string | null) {
  const normalizedMarketSlug = marketSlug?.trim()
  if (!normalizedMarketSlug) {
    return event.markets[0] ?? null
  }

  return event.markets.find(market => market.slug === normalizedMarketSlug) ?? event.markets[0] ?? null
}

function buildBreadcrumbTargets({
  event,
  pagePath,
  site,
  marketSlug,
}: {
  event: Event
  pagePath: string
  site: ThemeSiteIdentity
  marketSlug?: string | null
}) {
  const targets: StructuredDataBreadcrumbTarget[] = [{ name: site.name, path: '/' }]
  const seenPaths = new Set<string>(['/'])

  function addTarget(name: string | null | undefined, path: string | null | undefined) {
    const normalizedName = name?.trim()
    const normalizedPath = path?.trim()
    if (!normalizedName || !normalizedPath || seenPaths.has(normalizedPath)) {
      return
    }

    seenPaths.add(normalizedPath)
    targets.push({ name: normalizedName, path: normalizedPath })
  }

  if (event.sports_sport_slug?.trim()) {
    const sportsSlug = event.sports_sport_slug.trim().toLowerCase()
    addTarget('Sports', '/sports')
    addTarget(humanizeSlug(sportsSlug), `/sports/${sportsSlug}`)
  }
  else {
    const mainTag = event.tags.find(tag => tag.isMainCategory && isDynamicHomeCategorySlug(tag.slug)) ?? null
    const secondaryTag = mainTag
      ? event.tags.find(tag => !tag.isMainCategory && tag.slug.trim().length > 0)
      : null

    if (mainTag) {
      const mainTagSlug = mainTag.slug.trim().toLowerCase()
      addTarget(mainTag.name, `/${mainTagSlug}`)

      if (secondaryTag) {
        const secondarySlug = secondaryTag.slug.trim().toLowerCase()
        addTarget(secondaryTag.name, `/${mainTagSlug}/${secondarySlug}`)
      }
    }
  }

  const selectedMarket = marketSlug ? resolveSelectedMarket(event, marketSlug) : null
  addTarget(selectedMarket?.short_title?.trim() || selectedMarket?.title?.trim() || event.title, pagePath)

  return targets
}

export function buildSiteStructuredData({
  locale,
  site,
}: BuildSiteStructuredDataOptions) {
  const siteUrl = resolveSiteUrl(process.env)
  const organizationId = `${siteUrl}#organization`
  const websiteId = `${siteUrl}#website`
  const sameAs = getThemeSiteSameAs(site)
  const logoUrl = resolveAbsoluteUrl(site.logoImageUrl || site.pwaIcon512Url || site.pwaIcon192Url, siteUrl)

  const organization: StructuredDataNode = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId,
    'name': site.name,
    'description': site.description,
    'url': siteUrl,
  }

  if (logoUrl) {
    organization.logo = logoUrl
  }

  if (sameAs.length > 0) {
    organization.sameAs = sameAs
  }

  const website: StructuredDataNode = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    'url': siteUrl,
    'name': site.name,
    'description': site.description,
    'inLanguage': locale,
    'publisher': { '@id': organizationId },
  }

  return {
    organization,
    website,
  }
}

export function buildEventStructuredData({
  event,
  locale,
  pagePath,
  site,
  marketSlug,
  includeFaq = true,
}: BuildEventStructuredDataOptions) {
  const siteUrl = resolveSiteUrl(process.env)
  const pageUrl = buildAbsolutePageUrl(pagePath, locale, siteUrl)
  const eventOgImageUrl = buildEventOgImageUrl({
    eventSlug: event.slug,
    locale,
    marketSlug,
  })
  const imageUrls = resolveEventImageUrls(event, eventOgImageUrl, siteUrl)
  const startDate = event.start_date ?? event.created_at
  const endDate = event.end_date ?? event.resolved_at ?? null

  const eventNode: StructuredDataNode = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${pageUrl}#event`,
    'inLanguage': locale,
    'name': event.title,
    'description': buildEventStructuredDataDescription(event.title, site.name),
    'eventStatus': resolveEventSchemaStatus(event),
    'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode',
    'location': {
      '@type': 'VirtualLocation',
      'url': pageUrl,
    },
    'url': pageUrl,
    'organizer': { '@id': `${siteUrl}#organization` },
    'offers': {
      '@type': 'Offer',
      'url': pageUrl,
      'price': '0',
      'priceCurrency': 'USD',
      'availability': resolveOfferAvailability(event),
      'validFrom': startDate,
    },
  }

  if (imageUrls.length > 0) {
    eventNode.image = imageUrls
  }

  if (startDate) {
    eventNode.startDate = startDate
  }

  if (endDate) {
    eventNode.endDate = endDate
  }

  const breadcrumbTargets = buildBreadcrumbTargets({
    event,
    pagePath,
    site,
    marketSlug,
  })

  const breadcrumbList: StructuredDataNode = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbTargets.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': buildAbsolutePageUrl(item.path, locale, siteUrl),
    })),
  }

  const faqItems = includeFaq
    ? buildEventFaqItems({
        event,
        siteName: site.name,
      })
    : []

  const faqPage = faqItems.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faqItems.map(item => ({
          '@type': 'Question',
          'name': item.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': item.answer,
          },
        })),
      }
    : null

  return {
    event: eventNode,
    breadcrumbList,
    faqPage,
  }
}
