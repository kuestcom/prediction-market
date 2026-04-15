import { OPENAPI_SERVER_URLS } from '@/lib/openapi-servers'

function toUrlOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  }
  catch {
    return null
  }
}

function resolveCreatorHostname(siteUrl: string | undefined): string | null {
  const raw = siteUrl?.trim()
  if (!raw) {
    return null
  }

  try {
    const hostname = new URL(raw).hostname.trim()
    return hostname || null
  }
  catch {
    return null
  }
}

const allowedOrigins = new Set(
  Object.values(OPENAPI_SERVER_URLS)
    .filter((url): url is string => Boolean(url))
    .map(toUrlOrigin)
    .filter((origin): origin is string => Boolean(origin)),
)

function toProxyError(message: string, status: number): Response {
  return Response.json(message, { status })
}

async function proxy(request: Request): Promise<Response> {
  const proxyRequestUrl = new URL(request.url)
  const url = proxyRequestUrl.searchParams.get('url')

  if (!url) {
    return toProxyError('[Proxy] A `url` query parameter is required for proxy url', 400)
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  }
  catch {
    return toProxyError('[Proxy] Invalid `url` parameter value.', 400)
  }

  if (!allowedOrigins.has(parsedUrl.origin)) {
    return toProxyError(`[Proxy] The origin "${parsedUrl.origin}" is not allowed.`, 400)
  }

  const gammaOrigin = toUrlOrigin(OPENAPI_SERVER_URLS.gamma ?? '')
  if (gammaOrigin && parsedUrl.origin === gammaOrigin) {
    const creatorHostname = resolveCreatorHostname(process.env.SITE_URL)
    if (!creatorHostname) {
      return toProxyError('[Proxy] SITE_URL environment variable is not configured.', 500)
    }

    // Force the creator scope for docs playground requests (immutable).
    parsedUrl.searchParams.set('creator', creatorHostname)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('content-length')
  requestHeaders.delete('host')
  requestHeaders.delete('origin')
  requestHeaders.set('accept-encoding', 'identity')

  const method = request.method.toUpperCase()
  const canHaveBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method,
      cache: 'no-cache',
      headers: requestHeaders,
      body: canHaveBody ? await request.arrayBuffer() : undefined,
      redirect: 'follow',
    })
    const responseHeaders = new Headers(upstreamResponse.headers)

    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')
    responseHeaders.set('X-Forwarded-Host', upstreamResponse.url)
    responseHeaders.forEach((_value, key) => {
      if (key.toLowerCase().startsWith('access-control-')) {
        responseHeaders.delete(key)
      }
    })

    const body = method === 'HEAD' ? null : await upstreamResponse.arrayBuffer()

    return new Response(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return toProxyError(`[Proxy] Failed to proxy request: ${message}`, 500)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  return proxy(request)
}

export async function GET(request: Request): Promise<Response> {
  return proxy(request)
}

export async function HEAD(request: Request): Promise<Response> {
  return proxy(request)
}

export async function PATCH(request: Request): Promise<Response> {
  return proxy(request)
}

export async function POST(request: Request): Promise<Response> {
  return proxy(request)
}

export async function PUT(request: Request): Promise<Response> {
  return proxy(request)
}
