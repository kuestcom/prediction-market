import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export default async function NotFound() {
  const runtimeTheme = await loadRuntimeThemeState()
  const discordLink = runtimeTheme.site.discordLink

  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="h-auto w-24">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
          viewBox="0 0 123 150"
          fill="none"
        >
          <circle
            cx="61.017"
            cy="61.017"
            r="61.017"
            fill="url(#paint0_linear_214_459)"
          >
          </circle>
          <path
            d="M110.322 127.05C101.509 122.755 99.2967 113.409 99.42 108.475H23.0116C22.7458 117.334 16.5712 123.309 11.1292 126.573C8.17913 128.342 5.93207 131.342 5.93207 134.782V142C5.93207 146.418 9.5138 150 13.9321 150H108.949C113.367 150 116.949 146.418 116.949 142V135.962C116.949 131.98 113.901 128.794 110.322 127.05Z"
            fill="url(#paint1_linear_214_459)"
          >
          </path>
          <path
            d="M64.8305 33.0509L99.1526 14.4068L57.6271 33.0509L78.8136 58.0509L64.8305 76.6949L89.8305 58.0509L64.8305 33.0509Z"
            fill="#B5C9F7"
          >
          </path>
          <path
            d="M94.9151 129.661H7.32631C6.741 130.508 5.93207 132.109 5.93207 133.051H94.9151V129.661Z"
            fill="url(#paint2_linear_214_459)"
          >
          </path>
          <defs>
            <linearGradient
              id="paint0_linear_214_459"
              x1="61.017"
              y1="0"
              x2="61.017"
              y2="122.034"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F3F8FD"></stop>
              <stop offset="1" stopColor="#C0D2FB"></stop>
            </linearGradient>
            <linearGradient
              id="paint1_linear_214_459"
              x1="61.4405"
              y1="108.475"
              x2="61.4405"
              y2="150"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#40578C"></stop>
              <stop offset="1"></stop>
            </linearGradient>
            <linearGradient
              id="paint2_linear_214_459"
              x1="24.9421"
              y1="125.847"
              x2="25.4997"
              y2="135.215"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#B7CBF6" stopOpacity="0.6"></stop>
              <stop offset="0.941436" stopColor="white" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p className="mt-5 text-2xl font-medium text-primary">
        Oops...we didn&apos;t forecast this
      </p>
      {discordLink && (
        <p className="mt-3 text-sm text-muted-foreground">
          If reloading doesn&apos;t fix it, let us know via
          {' '}
          <span className="inline">
            <a
              href={discordLink}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Discord
            </a>
            .
          </span>
        </p>
      )}
      <Button asChild className="mt-5">
        <Link href={'/' as Route}>
          Go to home
        </Link>
      </Button>
    </main>
  )
}
