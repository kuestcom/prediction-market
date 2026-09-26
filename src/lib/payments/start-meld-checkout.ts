const PAYMENTS_WORKER_ORIGIN = 'https://payments.kuest.com'

interface MeldCheckoutPopup {
  closed: boolean
  close: () => void
  location: { replace: (url: string) => void }
}

interface StartMeldCheckoutOptions {
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  navigate?: (url: string) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLaunchUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  try {
    const url = new URL(value)
    return (
      url.origin === PAYMENTS_WORKER_ORIGIN &&
      /^\/launch\/[A-Za-z0-9_-]{40,64}$/u.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

export async function startMeldCheckout(
  popup: MeldCheckoutPopup | null,
  { fetcher = fetch, navigate = (url) => window.location.assign(url) }: StartMeldCheckoutOptions = {},
): Promise<void> {
  try {
    const response = await fetcher('/api/payments/meld/checkouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    let result: unknown
    try {
      result = await response.json()
    } catch {
      throw new Error('checkout_creation_failed')
    }
    if (
      !response.ok ||
      !isRecord(result) ||
      typeof result.checkoutId !== 'string' ||
      !/^[0-9a-f-]{36}$/iu.test(result.checkoutId) ||
      !isLaunchUrl(result.launchUrl)
    ) {
      throw new Error('checkout_creation_failed')
    }

    try {
      window.localStorage.setItem('kuest:pending-meld-checkout', result.checkoutId)
    } catch {
      // The return page continues status polling if storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent('kuest:meld-checkout-created', { detail: result.checkoutId }))

    if (popup && !popup.closed) {
      popup.location.replace(result.launchUrl)
    } else {
      navigate(result.launchUrl)
    }
  } catch (error) {
    if (popup && !popup.closed) {
      popup.close()
    }
    throw error
  }
}
