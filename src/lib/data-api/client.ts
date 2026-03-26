const DATA_API_URL = process.env.DATA_URL!

export function getDataApiUrl() {
  if (!DATA_API_URL) {
    throw new Error('DATA_URL environment variable is not configured.')
  }

  return DATA_API_URL
}

export function buildDataApiUrl(pathname: string, searchParams?: URLSearchParams | string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const query = typeof searchParams === 'string'
    ? searchParams
    : searchParams?.toString() ?? ''

  return `${getDataApiUrl()}${normalizedPath}${query ? `?${query}` : ''}`
}

export function normalizeDataApiAddress(value: string) {
  return value.trim().toLowerCase()
}
