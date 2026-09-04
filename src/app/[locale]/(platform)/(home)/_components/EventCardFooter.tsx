import { Repeat } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { Event } from '@/types'

import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { NewBadge } from '@/components/ui/new-badge'
import { Link } from '@/i18n/navigation'
import {
  isCryptoEvent,
  resolveCryptoCadenceRouteSlug,
  resolveCryptoEventAsset,
  resolveCryptoEventAssetName,
} from '@/lib/crypto-cadence-event'
import { formatVolume } from '@/lib/formatters'
import { isEventResolvedLike } from '@/lib/home-events'

interface EventCardFooterProps {
  event: Event
  shouldShowNewBadge: boolean
  showLiveBadge: boolean
  resolvedVolume: number
  endedLabel?: string | null
}

export default function EventCardFooter({
  event,
  shouldShowNewBadge,
  showLiveBadge,
  resolvedVolume,
  endedLabel,
}: EventCardFooterProps) {
  const t = useExtracted()
  const isResolvedEvent = isEventResolvedLike(event)
  const isCrypto = isCryptoEvent(event)
  const isLiveCryptoEvent = showLiveBadge && isCrypto
  const showNewBadge = shouldShowNewBadge && !showLiveBadge
  const isCryptoCadenceEvent = isCrypto && Boolean(resolveCryptoCadenceRouteSlug(event))
  const cryptoAsset = isCryptoCadenceEvent ? resolveCryptoEventAsset(event) : null
  const cryptoAssetName = cryptoAsset ? resolveCryptoEventAssetName(event) : null
  const shouldShowRecurrence = !isCryptoCadenceEvent && Boolean(event.series_recurrence?.trim())

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        {showLiveBadge && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="leading-none font-medium text-red-500 uppercase">{t('Live')}</span>
          </span>
        )}
        {showNewBadge ? (
          <NewBadge />
        ) : isLiveCryptoEvent ? null : (
          <span>{t('{amount} Vol.', { amount: formatVolume(resolvedVolume) })}</span>
        )}
        {cryptoAsset && cryptoAssetName && (
          <>
            <span aria-hidden>·</span>
            <Link
              href={`/crypto/${cryptoAsset.slug}`}
              className="transition-colors hover:text-foreground hover:underline"
            >
              {cryptoAssetName}
            </Link>
          </>
        )}
        {shouldShowRecurrence && <Repeat className="size-3" aria-label={t('Recurring event')} />}
      </div>
      {isResolvedEvent ? (
        endedLabel ? (
          <span>{endedLabel}</span>
        ) : null
      ) : (
        <EventBookmark event={event} refreshStatusOnMount={false} />
      )}
    </div>
  )
}
