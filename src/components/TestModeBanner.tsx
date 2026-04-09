import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useState } from 'react'

interface TestModeBannerProps {
  persistKey?: string
}

export default function TestModeBanner({
  persistKey = 'test_mode_banner_closed_session',
}: TestModeBannerProps) {
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(persistKey) === '1'
    }
    catch {
      return false
    }
  })

  const discordUrl = 'https://discord.gg/kuest'
  const t = useExtracted()

  if (closed) {
    return null
  }

  const message = (
    <>
      {t('Test mode is')}
      {' '}
      <span className="font-bold">{t('ON')}</span>
      .
      {' '}
      {t('Get free Amoy USDC in Discord with')}
      {' '}
      <span className="font-bold">/faucet</span>
    </>
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60">
      <div className="container flex justify-end">
        <div className="pointer-events-auto relative max-w-68 rounded-xl border bg-background text-foreground shadow-xl">
          <button
            type="button"
            onClick={() => {
              setClosed(true)
              try {
                sessionStorage.setItem(persistKey, '1')
              }
              catch {}
            }}
            className={`
              absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full border bg-background
              text-sm text-foreground/80 shadow-md transition-colors
              hover:text-foreground
            `}
            aria-label="Dismiss test mode banner"
          >
            &times;
          </button>
          <div className="py-3 pr-3 pl-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm/relaxed">{message}</p>
              <a
                href={discordUrl}
                target="_blank"
                rel="noreferrer"
                className={`
                  inline-flex w-fit items-center gap-2 rounded-md bg-[#5865F2] px-3 py-1.5 text-xs font-semibold
                  text-white transition
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
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
