'use client'

import Image from 'next/image'

import { cn } from '@/lib/utils'

import type { SportsMenuRenderableLinkEntry } from './sports-sidebar-menu-utils'

import FuturesStatusIcon from './FuturesStatusIcon'
import LiveStatusIcon from './LiveStatusIcon'
import UpcomingStatusIcon from './UpcomingStatusIcon'

function SportsMenuIcon({
  className,
  entry,
  futureIconVariant,
  isFutureLink,
  isLiveLink,
  nested,
}: {
  className?: string
  entry: SportsMenuRenderableLinkEntry
  futureIconVariant: 'futures' | 'upcoming'
  isFutureLink: boolean
  isLiveLink: boolean
  nested: boolean
}) {
  if (isLiveLink && !nested) {
    return <LiveStatusIcon className={className} />
  }

  if (isFutureLink && !nested) {
    return futureIconVariant === 'upcoming' ? (
      <UpcomingStatusIcon className={className} />
    ) : (
      <FuturesStatusIcon className={className} />
    )
  }

  return (
    <Image
      src={entry.iconPath}
      alt=""
      width={nested ? 16 : 20}
      height={nested ? 16 : 20}
      className={cn('size-full object-contain', className)}
    />
  )
}

export default SportsMenuIcon
