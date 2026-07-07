import type { Route } from 'next'
import AppLink from '@/components/AppLink'
import NotFoundContent from '@/components/NotFoundContent'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export default async function NotFound() {
  const runtimeTheme = await loadRuntimeThemeState()
  const discordLink = runtimeTheme.site.discordLink

  return (
    <NotFoundContent
      as="main"
      className="container flex min-h-[60vh] flex-col items-center justify-center p-8 text-center"
      discordLink={discordLink}
      homeLink={(
        <AppLink href={'/' as Route}>
          Go to home
        </AppLink>
      )}
    />
  )
}
