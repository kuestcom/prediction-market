'use cache'

import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'
import { cacheTag } from 'next/cache'

import type { SupportedLocale } from '@/i18n/locales'

import MentionsList from '@/app/[locale]/(platform)/mentions/_components/MentionsList'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  return {
    title: t('Mentions'),
    description: t('Live events where you can predict the words and phrases that will be said.'),
  }
}

export default async function MentionsPage({ params }: PageProps<'/[locale]/mentions'>) {
  const { locale } = await params
  const t = await getExtracted()
  cacheTag(cacheTags.eventsList)
  const resolvedLocale = locale as SupportedLocale

  const { data, error } = await EventRepository.listEvents({
    tag: 'mentions',
    locale: resolvedLocale,
  })

  const content = (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t('Mention Events')}</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          {t('Live events where you can predict the words and phrases that will be said.')}
        </p>
      </header>
      {data && <MentionsList events={data} />}
    </div>
  )

  if (error) {
    return (
      <main className="container-sm py-6 md:py-8">
        {content}
        <p className="text-sm text-muted-foreground">
          {t('Could not load Mentions events. Please try again in a moment.')}
        </p>
      </main>
    )
  }

  if (!data || data.length === 0) {
    return (
      <main className="container-sm py-6 md:py-8">
        {content}
        <p className="text-sm text-muted-foreground">{t('No Mentions events available right now. Check back soon.')}</p>
      </main>
    )
  }

  return <main className="container-sm py-6 md:py-8">{content}</main>
}
