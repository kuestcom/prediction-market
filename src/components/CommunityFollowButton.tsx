'use client'

import type { MouseEvent, PointerEvent } from 'react'

import { LoaderCircleIcon, UserCheckIcon, UserPlusIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { CommunityFollowStatus } from '@/lib/community-follows'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCommunityFollow } from '@/providers/CommunityFollowsProvider'

interface CommunityFollowButtonProps {
  wallet: string | null | undefined
  variant?: 'icon' | 'manage' | 'text'
  className?: string
  initialStatus?: CommunityFollowStatus | null
}

export default function CommunityFollowButton({
  wallet,
  variant = 'text',
  className,
  initialStatus,
}: CommunityFollowButtonProps) {
  const t = useExtracted()
  const follow = useCommunityFollow(wallet, initialStatus)
  if (!follow.canFollow) {
    return null
  }

  const label = follow.isFollowing ? t('Unfollow trader') : t('Follow trader')
  const Icon = follow.isFollowing ? UserCheckIcon : UserPlusIcon
  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
  }
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    void follow.toggleFollow()
  }
  const buttonText = follow.isFollowing ? (variant === 'manage' ? t('Unfollow') : t('Following')) : t('Follow')
  const button = (
    <Button
      type="button"
      variant={follow.isFollowing ? 'secondary' : 'default'}
      size={variant === 'icon' ? 'icon' : 'sm'}
      className={className}
      aria-label={label}
      aria-pressed={follow.isFollowing}
      aria-busy={follow.isPending}
      disabled={follow.isPending}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {follow.isPending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <Icon aria-hidden />}
      {variant === 'icon' ? null : buttonText}
    </Button>
  )

  if (variant !== 'icon') {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
