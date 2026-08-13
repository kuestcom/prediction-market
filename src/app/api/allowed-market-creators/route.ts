import { unstable_rethrow } from 'next/navigation'
import { NextResponse } from 'next/server'

import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const MANIFEST_SCHEMA_VERSION = 1
const MARKET_STATUS_PATH = '/api/markets/status'
const MAX_MANIFEST_BYTES = 256 * 1024
const MANIFEST_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400'

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function GET(request: Request) {
  try {
    const [{ data, error }, runtimeTheme] = await Promise.all([
      loadAllowedMarketCreatorWallets(),
      loadRuntimeThemeState(),
    ])
    if (error || !data) {
      return NextResponse.json({ error: error ?? DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const { chainId } = resolvePublicRuntimeEnv(process.env)
    const manifest = {
      wallets: data,
      schema_version: MANIFEST_SCHEMA_VERSION,
      chain_id: chainId,
      market_status_path: MARKET_STATUS_PATH,
      name: runtimeTheme.site.name,
      icons: [
        { src: runtimeTheme.site.pwaIcon192Url, sizes: '192x192' as const },
        { src: runtimeTheme.site.pwaIcon512Url, sizes: '512x512' as const },
      ],
    }
    const body = JSON.stringify(manifest)
    if (new TextEncoder().encode(body).byteLength > MAX_MANIFEST_BYTES) {
      console.error('Allowed market creators manifest exceeds the response limit.')
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const etag = `\"${await sha256Hex(body)}\"`
    const headers = {
      'Cache-Control': MANIFEST_CACHE_CONTROL,
      'Content-Type': 'application/json; charset=utf-8',
      ETag: etag,
    }

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers })
    }

    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    unstable_rethrow(error)
    console.error('Failed to load allowed market creators:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
