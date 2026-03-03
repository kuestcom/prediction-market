import { openapi } from '@/lib/openapi'
import { resolveServiceUrls, toUrlOrigin } from '@/lib/service-urls'

const serviceUrls = resolveServiceUrls()

const allowedOrigins = [
  serviceUrls.clobUrl,
  serviceUrls.dataUrl,
  serviceUrls.relayerUrl,
  serviceUrls.createMarketUrl,
  serviceUrls.communityUrl,
  serviceUrls.priceReferenceUrl,
]
  .map(toUrlOrigin)
  .filter((origin): origin is string => Boolean(origin))

export const { GET, POST, PUT, DELETE, PATCH, HEAD } = openapi.createProxy({
  allowedOrigins,
})
