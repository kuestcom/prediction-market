import type { MetadataRoute } from 'next'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { resolvePwaThemeColors } from '@/lib/pwa-colors'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const runtimeTheme = await loadRuntimeThemeState()
  const site = runtimeTheme.site
  const { lightSurface } = resolvePwaThemeColors(runtimeTheme.theme)

  return {
    name: site.name,
    short_name: site.name.slice(0, 32),
    description: site.description,
    start_url: `/${DEFAULT_LOCALE}`,
    scope: '/',
    display: 'standalone',
    background_color: lightSurface,
    theme_color: lightSurface,
    icons: [
      {
        src: site.pwaIcon192Url,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: site.pwaIcon512Url,
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: site.pwaIcon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
