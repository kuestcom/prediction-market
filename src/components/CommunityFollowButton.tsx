'use client'

import type { MouseEvent, PointerEvent } from 'react'

import { LoaderCircleIcon, UserCheckIcon, UserPlusIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCommunityFollow } from '@/providers/CommunityFollowsProvider'

interface CommunityFollowButtonProps {
  wallet: string | null | undefined
  variant?: 'icon' | 'text'
  className?: string
}

export default function CommunityFollowButton({ wallet, variant = 'text', className }: CommunityFollowButtonProps) {
  const t = useExtracted()
  const follow = useCommunityFollow(wallet)
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
      {variant === 'text' ? (follow.isFollowing ? t('Following') : t('Follow')) : null}
    </Button>
  )

  if (variant === 'text') {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
