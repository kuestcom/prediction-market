import * as Sentry from '@sentry/nextjs'
import { isNextNotFoundError } from '@/lib/next-http-fallback'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
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
