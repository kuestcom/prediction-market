export const MELD_CHECKOUT_RETURN_CHANNEL = 'kuest:meld-checkout-return'

export interface MeldCheckoutReturnMessage {
  type: 'return' | 'ack'
  checkoutId: string
}

export function isMeldCheckoutId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
}

export function isMeldCheckoutReturnMessage(value: unknown): value is MeldCheckoutReturnMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const message = value as Record<string, unknown>
  return (message.type === 'return' || message.type === 'ack') && isMeldCheckoutId(message.checkoutId)
}
