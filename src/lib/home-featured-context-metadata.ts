export interface HomeFeaturedNewsMetadata {
  title: string
  source: string
  url: string
  faviconUrl: string | null
  publishedAt: string | null
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

export async function fetchHomeFeaturedNewsMetadata(rawUrl: string): Promise<HomeFeaturedNewsMetadata> {
  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL must start with http:// or https://.')
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; KuestBot/1.0; +https://kuest.com)',
    },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  })
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
