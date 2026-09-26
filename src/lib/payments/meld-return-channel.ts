export const MELD_CHECKOUT_RETURN_CHANNEL = 'kuest:meld-checkout-return'

export interface MeldCheckoutReturnMessage {
  type: 'return' | 'ack'
  checkoutId: string
}

export function isMeldCheckoutReturnMessage(value: unknown): value is MeldCheckoutReturnMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const message = value as Record<string, unknown>
  return (
    (message.type === 'return' || message.type === 'ack') &&
    typeof message.checkoutId === 'string' &&
    /^[0-9a-f-]{36}$/iu.test(message.checkoutId)
  )
}
