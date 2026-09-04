import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import SettingsSdkApiKeysContent from '@/app/[locale]/(platform)/settings/_components/SettingsSdkApiKeysContent'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  generateSdkApiKeyAction: mock(),
  getNextSdkApiKeyNonceAction: mock(),
  openAppKit: mock(),
  revokeSdkApiKeyAction: mock(),
  signTypedDataAsync: mock(),
  toastError: mock(),
  toastSuccess: mock(),
  toastWarning: mock(),
  useAccount: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}))

void mock.module('wagmi', () => ({
  useAccount: () => mocks.useAccount(),
  useSignTypedData: () => ({
    signTypedDataAsync: mocks.signTypedDataAsync,
  }),
}))

void mock.module('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys', () => ({
  generateSdkApiKeyAction: (...args: unknown[]) => mocks.generateSdkApiKeyAction(...args),
  getNextSdkApiKeyNonceAction: (...args: unknown[]) => mocks.getNextSdkApiKeyNonceAction(...args),
  revokeSdkApiKeyAction: (...args: unknown[]) => mocks.revokeSdkApiKeyAction(...args),
}))

void mock.module('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    isReady: true,
    open: mocks.openAppKit,
  }),
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (callback: () => Promise<string>) => callback(),
  }),
}))

const USER_ADDRESS = '0x0000000000000000000000000000000000000abc'

describe('settingsSdkApiKeysContent', () => {
  beforeEach(() => {
    mocks.generateSdkApiKeyAction.mockReset()
    mocks.getNextSdkApiKeyNonceAction.mockReset()
    mocks.openAppKit.mockReset()
    mocks.revokeSdkApiKeyAction.mockReset()
    mocks.signTypedDataAsync.mockReset()
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.toastWarning.mockReset()
    mocks.useAccount.mockReset()

    mocks.useAccount.mockReturnValue({ address: USER_ADDRESS })
    mocks.getNextSdkApiKeyNonceAction.mockResolvedValue({ error: null, nonce: '0' })
  })

  it('shows a friendly SDK key error when the wallet RPC request is aborted', async () => {
    const user = userEvent.setup()
    mocks.signTypedDataAsync.mockRejectedValueOnce(
      new Error('An unknown RPC error occurred. Details: Request was aborted Version: viem@2.54.3'),
    )

    render(<SettingsSdkApiKeysContent />)

    await user.click(screen.getByRole('button', { name: 'Generate key' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('Unable to manage SDK key. Please try again.')
    })
    expect(mocks.toastError).not.toHaveBeenCalledWith(expect.stringContaining('viem@2.54.3'))
    expect(mocks.generateSdkApiKeyAction).not.toHaveBeenCalled()
  })
})
