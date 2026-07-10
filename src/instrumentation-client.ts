import type { PublicRuntimeConfig } from '@/lib/public-runtime-config.shared'
import * as Sentry from '@sentry/nextjs'
import { isNextClientStaleAssetError } from '@/lib/next-client-stale-assets'
import { isNextNotFoundError } from '@/lib/next-http-fallback'
import { isSiweVerificationError } from '@/lib/siwe-errors'

declare global {
  interface Window {
    __PUBLIC_RUNTIME_CONFIG__?: Partial<PublicRuntimeConfig>
  }
}

function normalizeSentryDsn(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
}

function resolveSentryDsn() {
  return typeof window === 'undefined'
    ? undefined
    : normalizeSentryDsn(window.__PUBLIC_RUNTIME_CONFIG__?.sentryDsn)
}

Sentry.init({
  dsn: resolveSentryDsn(),
  tracesSampleRate: 0.1,
  enableLogs: true,
  beforeSend(event, hint) {
    if (isNextNotFoundError(hint.originalException)) {
      return null
    }

    if (isNextClientStaleAssetError(hint.originalException)) {
      return null
    }

    if (isSiweVerificationError(hint.originalException)) {
      return null
    }

    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
