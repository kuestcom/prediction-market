import { describe, expect, it, vi } from 'vitest'

class MockUserRejectedRequestError extends Error {
  override name = 'UserRejectedRequestError'
}

vi.mock('viem', () => ({
  UserRejectedRequestError: MockUserRejectedRequestError,
}))

const {
  isRecoverableWalletConnectorError,
  isUserRejectedRequestError,
  isWalletConnectorNotConnectedError,
  normalizeAddress,
  WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE,
} = await import('@/lib/wallet')

describe('wallet', () => {
  describe('isUserRejectedRequestError', () => {
    it('detects viem UserRejectedRequestError instances', () => {
      expect(isUserRejectedRequestError(new MockUserRejectedRequestError('nope'))).toBe(true)
    })

    it('detects errors by name', () => {
      expect(isUserRejectedRequestError({ name: 'UserRejectedRequestError' })).toBe(true)
    })

    it('detects errors by message substring', () => {
      expect(isUserRejectedRequestError({ message: 'User rejected the request' })).toBe(true)
      expect(isUserRejectedRequestError({ message: 'USER REJECTED' })).toBe(true)
    })

    it('returns false for unrelated values', () => {
      expect(isUserRejectedRequestError(null)).toBe(false)
      expect(isUserRejectedRequestError(undefined)).toBe(false)
      expect(isUserRejectedRequestError({ name: 'OtherError' })).toBe(false)
      expect(isUserRejectedRequestError({ message: 'something else' })).toBe(false)
    })
  })

  describe('isWalletConnectorNotConnectedError', () => {
    it('detects wagmi connector errors by name', () => {
      expect(isWalletConnectorNotConnectedError({ name: 'ConnectorNotConnectedError' })).toBe(true)
      expect(isRecoverableWalletConnectorError({ name: 'ConnectorUnavailableReconnectingError' })).toBe(true)
    })

    it('detects wagmi connector errors by message without exposing the package version', () => {
      const error = {
        message: 'Connector not connected.\n\nVersion:\n@wagmi/core@2.22.1',
      }

      expect(isWalletConnectorNotConnectedError(error)).toBe(true)
      expect(WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE).toBe('Your wallet connection expired. Reconnect your wallet and try again.')
    })

    it('detects wagmi reconnecting connector errors by message', () => {
      expect(isRecoverableWalletConnectorError({
        message: 'Connector "WalletConnect" unavailable while reconnecting.\n\nVersion:\n@wagmi/core@2.22.1',
      })).toBe(true)
    })

    it('returns false for unrelated values', () => {
      expect(isWalletConnectorNotConnectedError(null)).toBe(false)
      expect(isWalletConnectorNotConnectedError(undefined)).toBe(false)
      expect(isWalletConnectorNotConnectedError({ name: 'ConnectorAlreadyConnectedError' })).toBe(false)
      expect(isWalletConnectorNotConnectedError({ message: 'wallet is locked' })).toBe(false)
    })
  })

  describe('normalizeAddress', () => {
    it('returns null for non-strings', () => {
      expect(normalizeAddress(null)).toBeNull()
      expect(normalizeAddress(undefined)).toBeNull()
      expect(normalizeAddress(123 as any)).toBeNull()
    })

    it('trims and validates 0x + 40 hex chars', () => {
      const addr = '0x00000000000000000000000000000000000000aA'
      expect(normalizeAddress(`  ${addr}  `)).toBe(addr)
      expect(normalizeAddress('0x123')).toBeNull()
      expect(normalizeAddress('0xZZ00000000000000000000000000000000000000')).toBeNull()
    })
  })
})
