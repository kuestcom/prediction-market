import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import { createMDX } from 'fumadocs-mdx/next'
import createNextIntlPlugin from 'next-intl/plugin'
import { getOptimizedImageHostPatterns } from '@/lib/image-optimization'
import siteUrlUtils from './src/lib/site-url'

const { resolveSiteUrl } = siteUrlUtils
const siteUrl = resolveSiteUrl(process.env)
const optimizedImageHostPatterns = getOptimizedImageHostPatterns(process.env)

const config: NextConfig = {
  output: process.env.VERCEL_ENV ? undefined : 'standalone',
  cacheComponents: true,
  typedRoutes: true,
  reactStrictMode: false,
  reactCompiler: true,
  staticPageGenerationTimeout: 180,
  experimental: {
    optimizePackageImports: ['radix-ui'],
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 8,
    serverActions: {
      bodySizeLimit: '2mb',
    },
    typedEnv: true,
  },
  images: {
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    loader: 'custom',
    loaderFile: './src/lib/wsrv-image-loader.ts',
    deviceSizes: [256],
    imageSizes: [16, 20, 24, 32, 36, 40, 42, 44, 48, 56, 64, 96, 128],
    remotePatterns: optimizedImageHostPatterns.map(hostname => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname: '/**',
    })),
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
        source: '/docs/:path*.md',
        destination: '/llms.md/:path*',
      },
      {
        source: '/:locale/docs/:path*.md',
        destination: '/llms.md/:path*',
      },
      {
        source: '/sitemaps/:id.xml',
        destination: '/sitemaps/sitemap/:id.xml',
      },
      {
        source: '/@:username',
        destination: '/profile/:username',
      },
      {
        source: '/:locale/@:username',
        destination: '/:locale/profile/:username',
      },
    ]
  },
  env: {
    IS_VERCEL: process.env.VERCEL_ENV ? 'true' : 'false',
    SITE_URL: siteUrl,
    SENTRY_DSN: process.env.SENTRY_DSN,
    REOWN_APPKIT_PROJECT_ID: process.env.REOWN_APPKIT_PROJECT_ID,
    CREATE_MARKET_URL: process.env.CREATE_MARKET_URL ?? 'https://create-market.kuest.com',
    GAMMA_URL: process.env.GAMMA_URL ?? 'https://gamma-api.kuest.com',
    GEOBLOCK_URL: process.env.GEOBLOCK_URL ?? 'https://geoblock.kuest.com',
    CLOB_URL: process.env.CLOB_URL ?? 'https://clob.kuest.com',
    RELAYER_URL: process.env.RELAYER_URL ?? 'https://relayer.kuest.com',
    DATA_URL: process.env.DATA_URL ?? 'https://data-api.kuest.com',
    USER_PNL_URL: process.env.USER_PNL_URL ?? 'https://user-pnl-api.kuest.com',
    COMMUNITY_URL: process.env.COMMUNITY_URL ?? 'https://community.kuest.com',
    SDK_DOWNLOAD_URL: process.env.SDK_DOWNLOAD_URL ?? 'https://sdk-download.kuest.com',
    PRICE_REFERENCE_URL: process.env.PRICE_REFERENCE_URL ?? 'https://price-reference.kuest.com',
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
