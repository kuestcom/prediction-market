import type { NextRequest } from 'next/server'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

function requireValue(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for embeds.`)
  }
  return value
}

function slugifySiteName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) {
    throw new Error('Site name must include at least one letter or number.')
  }
  return slug
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const marketSlug = searchParams.get('market') ?? ''
  const eventSlug = searchParams.get('event') ?? ''
  const affiliateCode = searchParams.get('r')?.trim() ?? ''
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light'
  const features = new Set(
    (searchParams.get('features') ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  )

  const showVolume = features.has('volume')
  const showChart = features.has('chart')
  const showFilters = showChart && features.has('filters')

  const siteUrl = normalizeBaseUrl(requireValue(process.env.SITE_URL, 'SITE_URL'))
  const scriptUrl = 'https://unpkg.com/@kuestcom/embeds/dist/index.js'
  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = requireValue(runtimeTheme.site.name, 'theme.site_name')
  const elementName = `${slugifySiteName(siteName)}-market-embed`
  const siteLogoUrl = runtimeTheme.site.logoUrl

  const attrs: string[] = [`theme="${theme}"`]
  if (marketSlug) {
    attrs.push(`market="${escapeAttr(marketSlug)}"`)
  }
  else if (eventSlug) {
    attrs.push(`event="${escapeAttr(eventSlug)}"`)
  }
  if (showVolume) {
    attrs.push('volume="true"')
  }
  if (showChart) {
    attrs.push('chart="true"')
  }
  if (showFilters) {
    attrs.push('filters="true"')
  }
  if (affiliateCode) {
    attrs.push(`affiliate="${escapeAttr(affiliateCode)}"`)
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      body { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    </style>
    <script>
      window.__KUEST_SITE_URL = ${JSON.stringify(siteUrl)};
      window.__KUEST_SITE_NAME = ${JSON.stringify(siteName)};
      window.__KUEST_SITE_LOGO_URL = ${JSON.stringify(siteLogoUrl)};
    </script>
    <script type="module" src="${scriptUrl}"></script>
  </head>
  <body>
    <${elementName} ${attrs.join(' ')}></${elementName}>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
