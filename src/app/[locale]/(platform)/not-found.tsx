import type { Route } from 'next'

import { getExtracted } from 'next-intl/server'

import NotFoundContent from '@/components/NotFoundContent'
import { Link } from '@/i18n/navigation'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export default async function NotFound() {
  const t = await getExtracted()
  const runtimeTheme = await loadRuntimeThemeState()
  const discordLink = runtimeTheme.site.discordLink

  return (
    <NotFoundContent
      as="main"
      className="container flex min-h-[60vh] flex-col items-center justify-center p-8 text-center"
      discordLink={discordLink}
      title={t('Oops...we didn’t forecast this')}
      description={
        <>
          {t('If reloading doesn’t fix it, let us know via')}{' '}
          <span className="inline">
            <a href={discordLink ?? '#'} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Discord
            </a>
            .
          </span>
        </>
      }
      homeLink={<Link href={'/' as Route}>{t('Go to home')}</Link>}
    />
  )
}
