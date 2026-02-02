import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import MentionsList from '@/app/[locale]/(platform)/mentions/_components/MentionsList'
import { EventRepository } from '@/lib/db/queries/event'

export const metadata: Metadata = {
  title: 'Mentions',
}

export default async function MentionsPage({ params }: PageProps<'/[locale]/mentions'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const { data, error } = await EventRepository.listEvents({
    tag: 'mentions',
  })

  const content = (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Mention Events
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Live events where you can predict the words and phrases that will be said.
        </p>
      </header>
      {data && <MentionsList events={data} />}
    </div>
  )

  if (error) {
    return (
      <main className="container py-6 md:py-8">
        {content}
        <p className="text-sm text-muted-foreground">
          Could not load Mentions events. Please try again in a moment.
        </p>
      </main>
    )
  }

  if (!data || data.length === 0) {
    return (
      <main className="container py-6 md:py-8">
        {content}
        <p className="text-sm text-muted-foreground">
          No Mentions events available right now. Check back soon.
        </p>
      </main>
    )
  }

  return (
    <main className="container py-6 md:py-8">
      {content}
    </main>
  )
}
