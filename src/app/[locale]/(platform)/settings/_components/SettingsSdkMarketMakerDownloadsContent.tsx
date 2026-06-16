'use client'

import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

interface MarketMakerDownload {
  id: string
  label: string
  href: string
  logoSrc: string
}

interface SettingsSdkMarketMakerDownloadsContentProps {
  downloadLabel: string
  generatingLabel: string
  items: MarketMakerDownload[]
}

export default function SettingsSdkMarketMakerDownloadsContent({
  downloadLabel,
  generatingLabel,
  items,
}: SettingsSdkMarketMakerDownloadsContentProps) {
  const t = useExtracted()
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(() => new Set())

  function startLoading(itemId: string) {
    setLoadingItemIds((current) => {
      const next = new Set(current)
      next.add(itemId)
      return next
    })
  }

  function stopLoading(itemId: string) {
    setLoadingItemIds((current) => {
      if (!current.has(itemId)) {
        return current
      }

      const next = new Set(current)
      next.delete(itemId)
      return next
    })
  }

  async function handleDownload(item: MarketMakerDownload) {
    startLoading(item.id)

    try {
      const response = await fetch(item.href)
      if (!response.ok) {
        throw new Error(`Market maker example download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = objectUrl
      anchor.download = getFilenameFromResponse(response, item.id)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    }
    catch (error) {
      console.error('Failed to download market maker example', error)
      toast.error(t('An unexpected error occurred. Please try again.'))
    }
    finally {
      stopLoading(item.id)
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <ul className="divide-y">
        {items.map((item) => {
          const isLoading = loadingItemIds.has(item.id)

          return (
            <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <span className="flex min-w-0 items-center gap-3 text-sm font-medium">
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 bg-muted-foreground/35"
                  style={{
                    WebkitMaskImage: `url(${item.logoSrc})`,
                    maskImage: `url(${item.logoSrc})`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
                <span className="min-w-0">{item.label}</span>
              </span>
              <button
                type="button"
                className="
                  shrink-0 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors
                  hover:text-foreground hover:underline
                  disabled:pointer-events-none disabled:opacity-50
                "
                disabled={isLoading}
                onClick={() => handleDownload(item)}
              >
                {isLoading ? generatingLabel : downloadLabel}
              </button>
            </li>
          )
        })}
      </ul>
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
