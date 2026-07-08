import { UserRejectedRequestError } from 'viem'

export const WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE = 'Your wallet connection expired. Reconnect your wallet and try again.'

const RECOVERABLE_WALLET_CONNECTOR_ERROR_NAMES = new Set([
  'ConnectorAccountNotFoundError',
  'ConnectorChainMismatchError',
  'ConnectorNotConnectedError',
  'ConnectorNotFoundError',
  'ConnectorUnavailableReconnectingError',
])

function readWalletErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }

  return null
}

export function isUserRejectedRequestError(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) {
    return true
  }

  if (typeof error === 'object' && error !== null) {
    const name = 'name' in error ? (error as { name?: string }).name : undefined
    if (name === 'UserRejectedRequestError') {
      return true
    }

    const message = readWalletErrorMessage(error)
    const normalizedMessage = message?.toLowerCase()
    if (
      normalizedMessage?.includes('user rejected')
      || normalizedMessage?.includes('user denied')
      || normalizedMessage?.includes('rejected the request')
    ) {
      return true
    }
  }

  return false
}

export function isWalletRpcRequestAbortedError(error: unknown): boolean {
  const message = readWalletErrorMessage(error)
  const normalizedMessage = message?.toLowerCase()

  return Boolean(
    normalizedMessage?.includes('request was aborted')
    && (
      normalizedMessage.includes('rpc error')
      || normalizedMessage.includes('viem@')
    ),
  )
}

export function isRecoverableWalletConnectorError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const name = 'name' in error ? (error as { name?: string }).name : undefined
  if (name && RECOVERABLE_WALLET_CONNECTOR_ERROR_NAMES.has(name)) {
    return true
  }

  const message = 'message' in error ? (error as { message?: string }).message : undefined
  if (typeof message !== 'string') {
    return false
  }

  const normalizedMessage = message.toLowerCase()
  if (
    normalizedMessage.includes('connector not connected')
    || normalizedMessage.includes('connector not found')
    || normalizedMessage.includes('unavailable while reconnecting')
    || normalizedMessage.includes('not found for connector')
    || (
      normalizedMessage.includes('current chain of the connector')
      && normalizedMessage.includes('does not match')
    )
  ) {
    return true
  }

  return false
}

export function isWalletConnectorNotConnectedError(error: unknown): boolean {
  return isRecoverableWalletConnectorError(error)
}

export function normalizeAddress(value?: string | null): `0x${string}` | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed as `0x${string}` : null
}
