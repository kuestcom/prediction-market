import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDepositWalletPolling } from '@/hooks/useDepositWalletPolling'
import { useUser } from '@/stores/useUser'

describe('useDepositWalletPolling', () => {
  beforeEach(() => {
    useUser.setState({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'trader',
      image: '',
      settings: {},
      is_admin: false,
      deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      deposit_wallet_status: 'deploying',
      deposit_wallet_tx_hash: '0xtx',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useUser.setState(null)
  })

  it('clears a stale transaction hash when the polling response normalizes it to null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        deposit_wallet_address: '0x0000000000000000000000000000000000000002',
        deposit_wallet_signature: null,
        deposit_wallet_signed_at: null,
        deposit_wallet_status: 'deployed',
        deposit_wallet_tx_hash: null,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() =>
      useDepositWalletPolling({
        userId: 'user-1',
        depositWalletAddress: '0x0000000000000000000000000000000000000002',
        depositWalletStatus: 'deploying',
        hasDeployedDepositWallet: false,
        hasDepositWalletAddress: true,
      }),
    )

    await waitFor(() => {
      expect(useUser.getState()?.deposit_wallet_status).toBe('deployed')
    })

    expect(useUser.getState()?.deposit_wallet_tx_hash).toBeNull()
  })
})
