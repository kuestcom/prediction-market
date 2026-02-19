import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import { createMDX } from 'fumadocs-mdx/next'
import createNextIntlPlugin from 'next-intl/plugin'
import siteUrlUtils from './src/lib/site-url'

const { isVercelEnv, resolveSiteUrl } = siteUrlUtils
const siteUrl = resolveSiteUrl(process.env)
const isVercel = isVercelEnv(process.env)

const config: NextConfig = {
  ...(isVercel ? {} : { output: 'standalone' }),
  cacheComponents: true,
  typedRoutes: true,
  reactStrictMode: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: 'default-src \'self\'; script-src \'self\'',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/:locale/@:username',
        destination: '/:locale/:username',
      },
    ]
  },
  env: {
    IS_VERCEL: isVercel ? 'true' : 'false',
    SITE_URL: siteUrl,
    SENTRY_DSN: process.env.SENTRY_DSN,
    CREATE_MARKET_URL: process.env.CREATE_MARKET_URL ?? 'https://create-market.kuest.com',
    CLOB_URL: process.env.CLOB_URL ?? 'https://clob.kuest.com',
    RELAYER_URL: process.env.RELAYER_URL ?? 'https://relayer.kuest.com',
    DATA_URL: process.env.DATA_URL ?? 'https://data-api.kuest.com',
    USER_PNL_URL: process.env.USER_PNL_URL ?? 'https://user-pnl-api.kuest.com',
    COMMUNITY_URL: process.env.COMMUNITY_URL ?? 'https://community.kuest.com',
    WS_CLOB_URL: process.env.WS_CLOB_URL ?? 'wss://ws-subscriptions-clob.kuest.com',
    WS_LIVE_DATA_URL: process.env.WS_LIVE_DATA_URL ?? 'wss://ws-live-data.kuest.com',
  },
}

const withMDX = createMDX({
  configPath: 'docs.config.ts',
})

const withNextIntl = createNextIntlPlugin({
  experimental: {
    srcPath: './src',
    extract: {
      sourceLocale: 'en',
    },
    messages: {
      path: './src/i18n/messages',
      format: 'json',
      locales: 'infer',
    },
  },
})

export default withSentryConfig(withNextIntl(withMDX(config)), {
  telemetry: false,
})
