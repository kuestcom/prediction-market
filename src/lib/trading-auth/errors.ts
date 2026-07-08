export const UNAUTHENTICATED_ERROR = 'Unauthenticated.'
export const TRADING_AUTH_REQUIRED_ERROR = 'Enable trading to continue.'
export const TRADING_DEPOSIT_WALLET_REQUIRED_ERROR = 'Set up your Deposit Wallet before trading.'

export function isTradingAuthRequiredError(message: string | null | undefined) {
  if (!message) {
    return false
  }

  return (
    message === TRADING_AUTH_REQUIRED_ERROR
    || message === TRADING_DEPOSIT_WALLET_REQUIRED_ERROR
    || message.toLowerCase().includes('enable trading')
    || message.toLowerCase().includes('set up your deposit wallet')
  )
}
