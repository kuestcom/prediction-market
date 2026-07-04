import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

export interface HomeFeaturedNewsMetadata {
  title: string
  source: string
  url: string
  faviconUrl: string | null
  publishedAt: string | null
}

const MAX_METADATA_REDIRECTS = 5
const METADATA_REQUEST_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml',
  'User-Agent': 'Mozilla/5.0 (compatible; KuestBot/1.0; +https://kuest.com)',
}
const blockedNetworkRanges = new BlockList()

blockedNetworkRanges.addSubnet('0.0.0.0', 8, 'ipv4')
blockedNetworkRanges.addSubnet('10.0.0.0', 8, 'ipv4')
blockedNetworkRanges.addSubnet('100.64.0.0', 10, 'ipv4')
blockedNetworkRanges.addSubnet('127.0.0.0', 8, 'ipv4')
blockedNetworkRanges.addSubnet('169.254.0.0', 16, 'ipv4')
blockedNetworkRanges.addSubnet('172.16.0.0', 12, 'ipv4')
blockedNetworkRanges.addSubnet('192.0.0.0', 24, 'ipv4')
blockedNetworkRanges.addSubnet('192.0.2.0', 24, 'ipv4')
blockedNetworkRanges.addSubnet('192.168.0.0', 16, 'ipv4')
blockedNetworkRanges.addSubnet('198.18.0.0', 15, 'ipv4')
blockedNetworkRanges.addSubnet('198.51.100.0', 24, 'ipv4')
blockedNetworkRanges.addSubnet('203.0.113.0', 24, 'ipv4')
blockedNetworkRanges.addSubnet('224.0.0.0', 4, 'ipv4')
blockedNetworkRanges.addSubnet('240.0.0.0', 4, 'ipv4')
blockedNetworkRanges.addSubnet('::', 128, 'ipv6')
blockedNetworkRanges.addSubnet('::1', 128, 'ipv6')
blockedNetworkRanges.addSubnet('64:ff9b::', 96, 'ipv6')
blockedNetworkRanges.addSubnet('100::', 64, 'ipv6')
blockedNetworkRanges.addSubnet('2001::', 32, 'ipv6')
blockedNetworkRanges.addSubnet('2001:db8::', 32, 'ipv6')
blockedNetworkRanges.addSubnet('2002::', 16, 'ipv6')
blockedNetworkRanges.addSubnet('fc00::', 7, 'ipv6')
blockedNetworkRanges.addSubnet('fe80::', 10, 'ipv6')
blockedNetworkRanges.addSubnet('ff00::', 8, 'ipv6')

export class HomeFeaturedNewsMetadataUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HomeFeaturedNewsMetadataUrlError'
  }
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeBasicEntities(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', '\'')
    .replaceAll('&apos;', '\'')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function extractTagAttributes(tag: string) {
  const attributes: Record<string, string> = {}

  for (const match of tag.matchAll(/([\w:][-.\w:]*)\s*=\s*(["'])(.*?)\2/g)) {
    const [, name, , value] = match
    if (name && value != null) {
      attributes[name.toLowerCase()] = decodeBasicEntities(value)
    }
  }

  return attributes
}

function extractMetaContent(body: string, attribute: 'name' | 'property', value: string) {
  for (const match of body.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = extractTagAttributes(match[0])
    if (attributes[attribute] === value && attributes.content) {
      return attributes.content
    }
  }

  return null
}

function extractTitle(body: string) {
  return decodeBasicEntities(stripTags(
    extractMetaContent(body, 'property', 'og:title')
    ?? extractMetaContent(body, 'name', 'twitter:title')
    ?? body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? '',
  ))
}

function extractSource(body: string, url: URL) {
  return decodeBasicEntities(stripTags(
    extractMetaContent(body, 'property', 'og:site_name')
    ?? extractMetaContent(body, 'name', 'application-name')
    ?? url.hostname.replace(/^www\./, ''),
  ))
}

function extractPublishedAt(body: string) {
  const value = extractMetaContent(body, 'property', 'article:published_time')
    ?? extractMetaContent(body, 'name', 'date')
    ?? extractMetaContent(body, 'name', 'pubdate')
    ?? extractMetaContent(body, 'name', 'publish-date')
  if (!value) {
    return null
  }

  const date = new Date(decodeBasicEntities(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function resolveHtmlLink(baseUrl: URL, href: string | null | undefined) {
  const trimmed = href?.trim()
  if (!trimmed || trimmed.startsWith('#') || /^javascript:/i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return null
  }

  try {
    return new URL(decodeBasicEntities(trimmed), baseUrl).toString()
  }
  catch {
    return null
  }
}

function extractFaviconUrl(body: string, url: URL) {
  for (const match of body.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = extractTagAttributes(match[0])
    if (attributes.rel?.toLowerCase().includes('icon')) {
      const resolved = resolveHtmlLink(url, attributes.href)
      if (resolved) {
        return resolved
      }
    }
  }

  return new URL('/favicon.ico', url.origin).toString()
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function isBlockedHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === 'metadata'
    || hostname === 'metadata.google.internal'
    || (!isIP(hostname) && !hostname.includes('.'))
}

function isBlockedIpAddress(address: string) {
  const ipv4MappedAddress = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1]
  if (ipv4MappedAddress) {
    return isBlockedIpAddress(ipv4MappedAddress)
  }

  const ipv4MappedHexAddress = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (ipv4MappedHexAddress) {
    const high = Number.parseInt(ipv4MappedHexAddress[1] ?? '', 16)
    const low = Number.parseInt(ipv4MappedHexAddress[2] ?? '', 16)
    if (Number.isFinite(high) && Number.isFinite(low)) {
      return isBlockedIpAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
  }

  const family = isIP(address)
  return family === 4
    ? blockedNetworkRanges.check(address, 'ipv4')
    : family === 6 && blockedNetworkRanges.check(address, 'ipv6')
}

async function assertFetchableHttpUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HomeFeaturedNewsMetadataUrlError('URL must start with http:// or https://.')
  }
  if (url.username || url.password) {
    throw new HomeFeaturedNewsMetadataUrlError('URL must not include credentials.')
  }

  const hostname = normalizeHostname(url.hostname)
  if (isBlockedHostname(hostname) || isBlockedIpAddress(hostname)) {
    throw new HomeFeaturedNewsMetadataUrlError('URL host is not allowed.')
  }

  const addresses = await lookup(hostname, { all: true, verbatim: false })
  if (addresses.length === 0 || addresses.some(address => isBlockedIpAddress(address.address))) {
    throw new HomeFeaturedNewsMetadataUrlError('URL host is not allowed.')
  }
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400
}

async function fetchMetadataResponse(initialUrl: URL) {
  let url = initialUrl

  for (let redirectCount = 0; redirectCount <= MAX_METADATA_REDIRECTS; redirectCount += 1) {
    await assertFetchableHttpUrl(url)

    const response = await fetch(url.toString(), {
      headers: METADATA_REQUEST_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })

    if (!isRedirectStatus(response.status)) {
      const responseUrl = response.url ? new URL(response.url) : url
      await assertFetchableHttpUrl(responseUrl)

      return { response, url: responseUrl }
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new Error(`Could not fetch URL metadata (${response.status}).`)
    }

    url = new URL(location, url)
  }

  throw new Error('Too many redirects while fetching URL metadata.')
}

export async function fetchHomeFeaturedNewsMetadata(rawUrl: string): Promise<HomeFeaturedNewsMetadata> {
  const initialUrl = new URL(rawUrl)
  const { response, url } = await fetchMetadataResponse(initialUrl)

  if (!response.ok) {
    throw new Error(`Could not fetch URL metadata (${response.status}).`)
  }

  const body = (await response.text()).slice(0, 1_000_000)
  const title = extractTitle(body)

  return {
    title: title || url.hostname.replace(/^www\./, ''),
    source: extractSource(body, url),
    url: url.toString(),
    faviconUrl: extractFaviconUrl(body, url),
    publishedAt: extractPublishedAt(body),
  }
}
