import type { Metadata } from 'next'
import { ArrowRightIcon, BookOpenIcon } from 'lucide-react'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isAddress, zeroAddress } from 'viem'
import SettingsSdkDownloadsContent from '@/app/[locale]/(platform)/settings/_components/SettingsSdkDownloadsContent'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { addressToBuilderCode } from '@/lib/builder-code'
import { DEFAULT_FEE_RECEIVER_WALLET_ADDRESS } from '@/lib/contracts'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { getBlockedCountriesFromSettings } from '@/lib/geoblock-settings'
import resolveSiteUrl from '@/lib/site-url'

const SDK_DOWNLOAD_URL = process.env.SDK_DOWNLOAD_URL!

export async function generateMetadata({ params }: PageProps<'/[locale]/settings/sdks'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return {
    title: t('SDK Downloads'),
  }
}

export default async function SdkDownloadsSettingsPage({ params }: PageProps<'/[locale]/settings/sdks'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    notFound()
  }

  const { data: allSettings } = await SettingsRepository.getSettings()
  const siteUrl = resolveSiteUrl(process.env)
  const feeReceiverSetting = allSettings?.general?.fee_recipient_wallet?.value
  const feeReceiver
    = feeReceiverSetting && isAddress(feeReceiverSetting) && feeReceiverSetting.toLowerCase() !== zeroAddress
      ? feeReceiverSetting
      : DEFAULT_FEE_RECEIVER_WALLET_ADDRESS
  const builderCode = addressToBuilderCode(feeReceiver)
  const geoblock = getBlockedCountriesFromSettings(allSettings ?? undefined).length > 0

  function buildDownloadUrl(language: 'python' | 'rust' | 'typescript', sdk: 'clob' | 'relayer') {
    const url = new URL('/download', SDK_DOWNLOAD_URL)
    url.searchParams.set('sdk', sdk)
    url.searchParams.set('language', language)
    url.searchParams.set('site_url', siteUrl)

    if (sdk === 'clob') {
      url.searchParams.set('builder_code', builderCode)
      url.searchParams.set('geoblock', geoblock ? 'true' : 'false')
    }

    return url.toString()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('SDK Downloads')}</h1>
        <p className="text-muted-foreground">
          {t('Build trading bots and integrations with personalized SDK bundles. The CLOB client handles orderbook trading, while the Relayer client helps route and execute signed actions.')}
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl lg:mx-0">
        <SettingsSdkDownloadsContent
          generatingLabel={t('Generating...')}
          cards={[
            {
              id: 'python-client',
              title: t('Python Client'),
              description: t('CLOB and relayer bundles for Python bots and services.'),
              logoSrc: '/images/sdks/python.svg',
              actions: [
                {
                  id: 'python-clob',
                  label: t('CLOB'),
                  href: buildDownloadUrl('python', 'clob'),
                  variant: 'default',
                },
                {
                  id: 'python-relayer',
                  label: t('Relayer'),
                  href: buildDownloadUrl('python', 'relayer'),
                  variant: 'outline',
                },
              ],
            },
            {
              id: 'rust-client',
              title: t('Rust Client'),
              description: t('CLOB and relayer bundles for Rust services and automations.'),
              logoSrc: '/images/sdks/rust.svg',
              actions: [
                {
                  id: 'rust-clob',
                  label: t('CLOB'),
                  href: buildDownloadUrl('rust', 'clob'),
                  variant: 'default',
                },
                {
                  id: 'rust-relayer',
                  label: t('Relayer'),
                  href: buildDownloadUrl('rust', 'relayer'),
                  variant: 'outline',
                },
              ],
            },
            {
              id: 'typescript-client',
              title: t('TypeScript Client'),
              description: t('CLOB and relayer bundles for web apps, bots, and Node.js services.'),
              logoSrc: '/images/sdks/typescript.svg',
              actions: [
                {
                  id: 'typescript-clob',
                  label: t('CLOB'),
                  href: buildDownloadUrl('typescript', 'clob'),
                  variant: 'default',
                },
                {
                  id: 'typescript-relayer',
                  label: t('Relayer'),
                  href: buildDownloadUrl('typescript', 'relayer'),
                  variant: 'outline',
                },
              ],
            },
          ]}
        />
      </div>

      <div className="
        mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-lg border bg-card p-4
        sm:flex-row sm:items-center sm:justify-between sm:p-6
        lg:mx-0
      "
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpenIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <h2 className="text-base font-semibold tracking-tight">{t('Need implementation examples?')}</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t('Read the SDK documentation for CLOB trading, relayer wallet actions, and market maker workflows.')}
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link href="/docs/api-reference/clients-sdks">
            {t('Open documentation')}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
