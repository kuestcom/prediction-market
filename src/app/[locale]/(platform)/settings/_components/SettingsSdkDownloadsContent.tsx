'use client'

import { DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SdkCard {
  id: string
  title: string
  description: string
  href: string
  logoSrc: string
}

interface SettingsSdkDownloadsContentProps {
  cards: SdkCard[]
  downloadLabel: string
  generatingLabel: string
}

function useSdkDownloadState() {
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null)
  return { loadingCardId, setLoadingCardId }
}

export default function SettingsSdkDownloadsContent({
  cards,
  downloadLabel,
  generatingLabel,
}: SettingsSdkDownloadsContentProps) {
  const { loadingCardId, setLoadingCardId } = useSdkDownloadState()

  async function handleDownload(card: SdkCard) {
    setLoadingCardId(card.id)

    try {
      const response = await fetch(card.href)
      if (!response.ok) {
        throw new Error(`SDK download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = objectUrl
      anchor.download = getFilenameFromResponse(response, card.id)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    }
    finally {
      setLoadingCardId(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map(card => (
        <div key={card.title} className="relative overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute top-4 right-4 size-16 bg-muted-foreground/10"
            style={{
              WebkitMaskImage: `url(${card.logoSrc})`,
              maskImage: `url(${card.logoSrc})`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />

          <div className="relative z-10 flex h-full min-h-44 flex-col justify-between gap-8">
            <div className="space-y-2 pr-20">
              <h3 className="max-w-56 text-xl font-semibold tracking-tight">{card.title}</h3>
              <p className="max-w-72 text-sm text-muted-foreground">{card.description}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-fit"
              disabled={loadingCardId === card.id}
              onClick={() => handleDownload(card)}
            >
              <DownloadIcon className="size-4" />
              {loadingCardId === card.id ? generatingLabel : downloadLabel}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function getFilenameFromResponse(response: Response, fallbackName: string) {
  const contentDisposition = response.headers.get('content-disposition')
  const utf8Filename = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (utf8Filename) {
    return decodeURIComponent(utf8Filename)
  }

  const plainFilename = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]
  if (plainFilename) {
    return plainFilename
  }

  return `${fallbackName}.zip`
}
