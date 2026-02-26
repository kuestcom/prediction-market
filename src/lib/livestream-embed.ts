export type LivestreamProvider = 'youtube' | 'twitch' | 'unknown'

export interface LivestreamEmbedTarget {
  provider: LivestreamProvider
  externalUrl: string
  embedUrl: string | null
}

function isExactDomainOrSubdomain(host: string, rootDomain: string) {
  return host === rootDomain || host.endsWith(`.${rootDomain}`)
}

function sanitizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed
  }
  catch {
    return null
  }
}

function resolveYoutubeVideoId(url: URL) {
  const host = url.hostname.toLowerCase()
  const pathname = url.pathname

  if (isExactDomainOrSubdomain(host, 'youtu.be')) {
    const videoId = pathname.split('/').filter(Boolean)[0]
    return videoId?.trim() || null
  }

  if (!isExactDomainOrSubdomain(host, 'youtube.com')) {
    return null
  }

  if (pathname === '/watch') {
    const videoId = url.searchParams.get('v')
    return videoId?.trim() || null
  }

  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) {
    return null
  }

  if (parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'shorts') {
    return parts[1]?.trim() || null
  }

  return null
}

function resolveTwitchTarget(url: URL) {
  const host = url.hostname.toLowerCase()
  if (!isExactDomainOrSubdomain(host, 'twitch.tv')) {
    return null
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const queryVideo = url.searchParams.get('video')?.trim()
  const queryChannel = url.searchParams.get('channel')?.trim()

  if (queryVideo) {
    return { kind: 'video' as const, id: queryVideo.replace(/^v/i, '') }
  }
  if (queryChannel) {
    return { kind: 'channel' as const, id: queryChannel }
  }

  if (parts[0] === 'videos' && parts[1]) {
    return { kind: 'video' as const, id: parts[1] }
  }

  if (parts[0]) {
    return { kind: 'channel' as const, id: parts[0] }
  }

  return null
}

function normalizeParentDomain(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/:\d+$/, '')
}

export function resolveLivestreamEmbedTarget(
  rawUrl: string,
  options?: { parentDomain?: string | null },
): LivestreamEmbedTarget | null {
  const parsedUrl = sanitizeUrl(rawUrl)
  if (!parsedUrl) {
    return null
  }

  const youtubeVideoId = resolveYoutubeVideoId(parsedUrl)
  if (youtubeVideoId) {
    const query = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    })
    return {
      provider: 'youtube',
      externalUrl: parsedUrl.toString(),
      embedUrl: `https://www.youtube.com/embed/${youtubeVideoId}?${query.toString()}`,
    }
  }

  const twitchTarget = resolveTwitchTarget(parsedUrl)
  if (twitchTarget) {
    const parentDomain = normalizeParentDomain(options?.parentDomain)
    if (!parentDomain) {
      return {
        provider: 'twitch',
        externalUrl: parsedUrl.toString(),
        embedUrl: null,
      }
    }

    const query = new URLSearchParams({
      autoplay: 'true',
      parent: parentDomain,
    })

    if (twitchTarget.kind === 'video') {
      query.set('video', `v${twitchTarget.id.replace(/^v/i, '')}`)
    }
    else {
      query.set('channel', twitchTarget.id)
    }

    return {
      provider: 'twitch',
      externalUrl: parsedUrl.toString(),
      embedUrl: `https://player.twitch.tv/?${query.toString()}`,
    }
  }

  return {
    provider: 'unknown',
    externalUrl: parsedUrl.toString(),
    embedUrl: null,
  }
}
