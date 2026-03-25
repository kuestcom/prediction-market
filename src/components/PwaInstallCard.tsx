'use client'

import { DownloadIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import Image from 'next/image'
import { toast } from 'sonner'
import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

const installDescriptionByLocale: Record<string, string> = {
  de: 'Speichere diese App auf deinem Gerät, damit du sie beim nächsten Mal schneller öffnen kannst.',
  en: 'Save this app to your device for quicker access next time.',
  es: 'Guarda esta aplicación en tu dispositivo para abrirla más rápido la próxima vez.',
  fr: 'Enregistrez cette application sur votre appareil pour l\'ouvrir plus vite la prochaine fois.',
  pt: 'Salve este app no seu dispositivo para abrir mais rápido da próxima vez.',
  zh: '将此应用保存到你的设备，方便下次更快打开。',
}

export default function PwaInstallCard() {
  const t = useExtracted()
  const locale = useLocale()
  const site = useSiteIdentity()
  const { canShowInstallUi, isIos, isPrompting, requestInstall } = usePwaInstall()
  const desktopDescription = installDescriptionByLocale[locale] ?? installDescriptionByLocale.en
  const buttonLabel = isPrompting ? t('Opening...') : `${t('Install')} ${site.name}`

  if (!canShowInstallUi) {
    return null
  }

  return (
    <section className="relative h-full overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
      <DownloadIcon
        className="pointer-events-none absolute -top-10 -right-10 size-44 text-muted-foreground/10"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-44 flex-col gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">PWA</p>
          <h2 className="max-w-52 text-xl font-semibold tracking-tight text-foreground">
            {t('Install app')}
          </h2>

          {isIos
            ? (
                <PwaInstallIosInstructions className="max-w-72" />
              )
            : (
                <p className="max-w-64 text-sm text-muted-foreground">
                  {desktopDescription}
                </p>
              )}
        </div>

        {!isIos && (
          <Button
            type="button"
            variant="secondary"
            className="mt-1 h-11 w-full justify-start gap-3 rounded-md px-3 text-sm sm:w-fit"
            onClick={() => {
              void (async () => {
                try {
                  await requestInstall()
                }
                catch {
                  toast.error(t('An unexpected error occurred. Please try again.'))
                }
              })()
            }}
            disabled={isPrompting}
          >
            <Image
              src={site.pwaIcon192Url}
              alt={t('PWA icon 192x192')}
              width={28}
              height={28}
              className="rounded-sm object-cover"
              unoptimized
            />
            <span className="truncate">{buttonLabel}</span>
          </Button>
        )}
      </div>
    </section>
  )
}
