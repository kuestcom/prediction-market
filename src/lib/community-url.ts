export function buildCommunityApiUrl(communityApiUrl: string, endpointPath: string) {
  const url = new URL(communityApiUrl)
  const basePath = url.pathname.replace(/\/+$/, '')
  const endpoint = endpointPath.trim().replace(/^\/+/, '')

  url.pathname = endpoint ? `${basePath}/${endpoint}` : basePath || '/'
  url.search = ''

  return url
}
