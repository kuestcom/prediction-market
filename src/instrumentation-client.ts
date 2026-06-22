import type { PublicRuntimeConfig } from '@/lib/public-runtime-config'
import * as Sentry from '@sentry/nextjs'
import { isNextNotFoundError } from '@/lib/next-http-fallback'

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
  const runtimeDsn = typeof window === 'undefined'
    ? undefined
    : normalizeSentryDsn(window.__PUBLIC_RUNTIME_CONFIG__?.sentryDsn)

  return runtimeDsn ?? normalizeSentryDsn(process.env.SENTRY_DSN)
}

Sentry.init({
  dsn: resolveSentryDsn(),
  tracesSampleRate: 0.1,
  enableLogs: true,
  beforeSend(event, hint) {
    if (isNextNotFoundError(hint.originalException)) {
      return null
    }

    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
