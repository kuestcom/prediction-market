import * as Sentry from '@sentry/nextjs'

export async function register() {
  await import('../sentry.server.config')
}

export const onRequestError = Sentry.captureRequestError
