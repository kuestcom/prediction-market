export const PAYMENTS_WORKER_ORIGIN = 'https://payments.kuest.com'

export function isPaymentsLaunchUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)
    return (
      url.origin === PAYMENTS_WORKER_ORIGIN &&
      !url.username &&
      !url.password &&
      /^\/launch\/[A-Za-z0-9_-]{40,64}$/u.test(url.pathname) &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}
