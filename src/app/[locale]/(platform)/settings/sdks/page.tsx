import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isAddress, zeroAddress } from 'viem'
import SettingsSdkDownloadsContent from '@/app/[locale]/(platform)/settings/_components/SettingsSdkDownloadsContent'
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

  function buildDownloadUrl(language: 'python' | 'rust' | 'typescript') {
    const url = new URL('/download', SDK_DOWNLOAD_URL)
    url.searchParams.set('language', language)
    url.searchParams.set('site_url', siteUrl)
    url.searchParams.set('builder_code', builderCode)
    url.searchParams.set('geoblock', geoblock ? 'true' : 'false')
    return url.toString()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('SDK Downloads')}</h1>
        <p className="text-muted-foreground">
          {t('Automate your edge on prediction markets with programmable trading bots')}
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl lg:mx-0">
        <SettingsSdkDownloadsContent
          downloadLabel={t('Download')}
          generatingLabel={t('Generating...')}
          cards={[
            {
              id: 'python-client',
              title: t('Python Client'),
              description: t('SDK for building trading bots on Clob'),
              href: buildDownloadUrl('python'),
              logoSrc: '/images/sdks/python.svg',
            },
            {
              id: 'rust-client',
              title: t('Rust Client'),
              description: t('High-performance SDK for automated trading'),
              href: buildDownloadUrl('rust'),
              logoSrc: '/images/sdks/rust.svg',
            },
            {
              id: 'typescript-client',
              title: t('TypeScript Client'),
              description: t('Build trading bots for web and Node.js'),
              href: buildDownloadUrl('typescript'),
              logoSrc: '/images/sdks/typescript.svg',
            },
          ]}
        />
      </div>
    </section>
  )
}
