import type { ReactNode } from 'react'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppKitContext, defaultAppKitValue } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE } from '@/lib/wallet'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

const openAppKit = vi.fn()

function AppKitWrapper({ children }: { children: ReactNode }) {
  return <AppKitContext value={{ ...defaultAppKitValue, open: openAppKit }}>{children}</AppKitContext>
}

describe('useSignaturePromptRunner', () => {
  afterEach(() => {
    openAppKit.mockReset()
    useSignaturePrompt.getState().forceHidePrompt()
  })

  it('opens AppKit and replaces a stale connector error', async () => {
    const { result } = renderHook(() => useSignaturePromptRunner(), { wrapper: AppKitWrapper })

    await act(async () => {
      await expect(
        result.current.runWithSignaturePrompt(async () => {
          throw {
            name: 'ConnectorNotConnectedError',
            message: 'Connector not connected.\n\nVersion:\n@wagmi/core@2.22.1',
          }
        }),
      ).rejects.toThrow(WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE)
    })

    expect(openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    expect(useSignaturePrompt.getState().open).toBe(false)
  })
})
