import type { ReactNode } from 'react'
import Image from 'next/image'

interface EventTradeToastProps {
  title: string
  marketImage?: string
  marketTitle?: string
  children: ReactNode
}

export default function EventTradeToast({ title, marketImage, marketTitle, children }: EventTradeToastProps) {
  return (
    <div className="flex items-center gap-3">
      {marketImage && (
        <Image
          src={marketImage}
          alt={marketTitle || title}
          width={40}
          height={40}
          className="size-10 rounded-sm object-cover"
        />
      )}
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-1 text-xs opacity-80">
          {children}
        </div>
      </div>
    </div>
  )
}
