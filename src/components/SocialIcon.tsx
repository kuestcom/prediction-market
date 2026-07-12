import { cn } from '@/lib/utils'

export type SocialIconName
  = | 'discord'
    | 'email'
    | 'facebook'
    | 'instagram'
    | 'linkedin'
    | 'tiktok'
    | 'x'
    | 'youtube'

export default function SocialIcon({
  social,
  className,
}: {
  social: SocialIconName
  className?: string
}) {
  const iconUrl = `url(/images/social/${social}.svg)`

  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        WebkitMaskImage: iconUrl,
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskImage: iconUrl,
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
      }}
    />
  )
}
