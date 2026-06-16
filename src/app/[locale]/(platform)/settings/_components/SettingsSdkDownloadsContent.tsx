'use client'

import { DownloadIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface SdkCard {
  id: string
  title: string
  description?: string
  logoSrc: string
  actions: SdkDownloadAction[]
}

interface SdkDownloadAction {
  id: string
  label: string
  href: string
  variant: 'default' | 'outline'
}

interface SettingsSdkDownloadsContentProps {
  cards: SdkCard[]
  generatingLabel: string
}

function useSdkDownloadState() {
  const [loadingActionIds, setLoadingActionIds] = useState<Set<string>>(() => new Set())

  function startLoading(actionId: string) {
    setLoadingActionIds((current) => {
      const next = new Set(current)
      next.add(actionId)
      return next
    })
  }

  function stopLoading(actionId: string) {
    setLoadingActionIds((current) => {
      if (!current.has(actionId)) {
        return current
      }

      const next = new Set(current)
      next.delete(actionId)
      return next
    })
  }

  return { loadingActionIds, startLoading, stopLoading }
}

export default function SettingsSdkDownloadsContent({
  cards,
  generatingLabel,
}: SettingsSdkDownloadsContentProps) {
  const t = useExtracted()
  const { loadingActionIds, startLoading, stopLoading } = useSdkDownloadState()

  async function handleDownload(action: SdkDownloadAction) {
    startLoading(action.id)

    try {
      const response = await fetch(action.href)
      if (!response.ok) {
        throw new Error(`SDK download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = objectUrl
      anchor.download = getFilenameFromResponse(response, action.id)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    }
    catch (error) {
      console.error('Failed to download sdk', error)
      toast.error(t('An unexpected error occurred. Please try again.'))
    }
    finally {
      stopLoading(action.id)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map(card => (
        <div key={card.id} className="relative overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
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

          <div
            className={
              card.description
                ? 'relative z-10 flex h-full min-h-44 flex-col justify-between gap-8'
                : 'relative z-10 flex h-full flex-col gap-6'
            }
          >
            <div className="space-y-2 pr-20">
              <h3 className="max-w-56 text-xl font-semibold tracking-tight">{card.title}</h3>
              {card.description
                ? (
                    <p className="max-w-72 text-sm text-muted-foreground">{card.description}</p>
                  )
                : null}
            </div>

            <div className={card.actions.length > 1 ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
              {card.actions.map((action) => {
                const isLoading = loadingActionIds.has(action.id)

                return (
                  <Button
                    key={action.id}
                    type="button"
                    variant={action.variant}
                    size="sm"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => handleDownload(action)}
                  >
                    <DownloadIcon className="size-4" />
                    {isLoading ? generatingLabel : action.label}
                  </Button>
                )
              })}
            </div>
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
    try {
      return decodeURIComponent(utf8Filename)
    }
    catch {
      // Fall back to a safer filename when the header is malformed.
    }
  }

  const plainFilename = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]
  if (plainFilename) {
    return plainFilename
  }

  return `${fallbackName}.zip`
}
