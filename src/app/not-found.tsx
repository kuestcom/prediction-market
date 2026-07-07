import type { Route } from 'next'
import Link from 'next/link'
import NotFoundContent from '@/components/NotFoundContent'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export default async function NotFound() {
  const runtimeTheme = await loadRuntimeThemeState()
  const discordLink = runtimeTheme.site.discordLink

  return (
    <NotFoundContent
      className="flex h-screen w-full flex-col items-center justify-center p-8"
      discordLink={discordLink}
      homeLink={(
        <Link href={'/' as Route}>
          Go to home
        </Link>
      )}
    />
  )
}
