'use client'

import { useExtracted } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface TestModeBannerProps {
  persistKey?: string
}

export default function TestModeBanner({
  persistKey = 'test_mode_banner_closed_session',
}: TestModeBannerProps) {
  const [visible, setVisible] = useState<boolean | null>(null)
  const discordUrl = 'https://discord.gg/kuest'
  const t = useExtracted()
  const message = (
    <>
      {t('Test mode is')}
      {' '}
      <span className="font-bold">{t('ON')}</span>
      .
      {' '}
      {t('Get free Amoy USDC in Discord with')}
      {' '}
      <span className="font-bold">/airdrop</span>
    </>
  )

  useEffect(() => {
    try {
      const closed = sessionStorage.getItem(persistKey)
      setVisible(closed !== '1')
    }
    catch {
      setVisible(true)
    }
  }, [persistKey])

  if (visible !== true) {
    return null
  }

  return (
    <div className="fixed right-4 bottom-4 z-60 max-w-xs rounded-xl border bg-background text-foreground shadow-xl">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm/relaxed">
            {message}
          </p>
          <Link
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className={`
              inline-flex w-fit items-center gap-2 rounded-md bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white
              transition
              hover:bg-[#4752C4]
            `}
          >
            <Image
              src="/images/deposit/social-media/discord.svg"
              alt=""
              width={14}
              height={14}
              className="size-3.5 shrink-0 brightness-0 invert"
              aria-hidden="true"
            />
            {t('Open Discord')}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            try {
              sessionStorage.setItem(persistKey, '1')
            }
            catch {
              //
            }
          }}
          className="ml-2 inline-flex size-7 shrink-0 items-center justify-center text-lg text-foreground"
          aria-label="Dismiss test mode banner"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
