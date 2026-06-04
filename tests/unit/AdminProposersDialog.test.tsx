import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProposersDialog from '@/app/[locale]/admin/events/calendar/_components/AdminProposersDialog'

const CREATOR = getAddress('0x00000000000000000000000000000000000000aa')
const EMBEDDED_ACCOUNT = getAddress('0x00000000000000000000000000000000000000bb')
const REGISTRY = getAddress('0x00000000000000000000000000000000000000cc')
const WHITELIST = getAddress('0x00000000000000000000000000000000000000dd')
const PROPOSER = getAddress('0x00000000000000000000000000000000000000ee')

const mocks = vi.hoisted(() => ({
  useAppKitAccount: vi.fn(),
  useWalletClient: vi.fn(),
  usePublicClient: vi.fn(),
  useUser: vi.fn(),
  runWithSignaturePrompt: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  sendTransaction: vi.fn(),
  walletRequest: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  estimateFeesPerGas: vi.fn(),
  getGasPrice: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => mocks.useAppKitAccount(),
}))

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: mocks.useWalletClient() }),
  usePublicClient: () => mocks.usePublicClient(),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: mocks.runWithSignaturePrompt,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => <textarea {...props} />,
}))

describe('adminProposersDialog', () => {
  beforeEach(() => {
    mocks.useAppKitAccount.mockReturnValue({ address: CREATOR })
    mocks.useUser.mockReturnValue({ address: null })
    mocks.sendTransaction.mockReset()
    mocks.walletRequest.mockReset()
    mocks.waitForTransactionReceipt.mockReset()
    mocks.estimateFeesPerGas.mockReset()
    mocks.getGasPrice.mockReset()
    mocks.runWithSignaturePrompt.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()
    mocks.fetch.mockReset()

    mocks.useWalletClient.mockReturnValue({
      account: { address: EMBEDDED_ACCOUNT },
      chain: { id: 80002, name: 'Polygon Amoy' },
      sendTransaction: mocks.sendTransaction,
      request: mocks.walletRequest,
    })
    mocks.usePublicClient.mockReturnValue({
      estimateFeesPerGas: mocks.estimateFeesPerGas,
      getGasPrice: mocks.getGasPrice,
      waitForTransactionReceipt: mocks.waitForTransactionReceipt,
    })
    mocks.runWithSignaturePrompt.mockImplementation(async (callback: () => Promise<unknown>) => callback())
    mocks.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: 100n,
      maxPriorityFeePerGas: 10n,
    })
    mocks.getGasPrice.mockResolvedValue(100n)
    mocks.sendTransaction
      .mockResolvedValueOnce('0xdeploy')
      .mockResolvedValueOnce('0xregister')
    mocks.waitForTransactionReceipt
      .mockResolvedValueOnce({
        status: 'success',
        contractAddress: WHITELIST,
      })
      .mockResolvedValueOnce({
        status: 'success',
      })

    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [{
              address: CREATOR,
              displayName: 'EOA wallet',
              shortAddress: '0x0000...00AA',
              hasServerSigner: false,
            }],
            status: {
              creator: CREATOR,
              registryAddress: REGISTRY,
              whitelistAddress: null,
              proposers: [],
              hasServerSigner: false,
            },
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('uses the resolved AppKit EOA for whitelist creation even when walletClient account differs', async () => {
    const user = userEvent.setup()

    render(
      <AdminProposersDialog
        open
        onOpenChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.sendTransaction).toHaveBeenCalledTimes(2)
    })

    expect(mocks.sendTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({
      account: CREATOR,
      data: expect.stringMatching(/^0x/i),
      value: 0n,
    }))
    expect(mocks.sendTransaction).toHaveBeenNthCalledWith(2, expect.objectContaining({
      account: CREATOR,
      to: REGISTRY,
      data: expect.stringMatching(/^0x/i),
      value: 0n,
    }))
    expect(mocks.toastError).not.toHaveBeenCalledWith('Use the selected creator EOA in your wallet to sign this action.')
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('keeps server-signer fallback available when only the stored user address matches the selected creator', async () => {
    const user = userEvent.setup()

    mocks.useAppKitAccount.mockReturnValue({ address: null })
    mocks.useUser.mockReturnValue({ address: CREATOR })
    mocks.useWalletClient.mockReturnValue(null)
    mocks.usePublicClient.mockReturnValue(null)
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({
            data: [{
              address: CREATOR,
              displayName: 'Server signer',
              shortAddress: '0x0000...00AA',
            }],
          }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists?creator=')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [{
              address: CREATOR,
              displayName: 'Server signer',
              shortAddress: '0x0000...00AA',
              hasServerSigner: true,
            }],
            status: {
              creator: CREATOR,
              registryAddress: REGISTRY,
              whitelistAddress: null,
              proposers: [],
              hasServerSigner: true,
            },
          }),
        }
      }
      if (url.endsWith('/admin/api/proposer-whitelists') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            status: {
              creator: CREATOR,
              registryAddress: REGISTRY,
              whitelistAddress: WHITELIST,
              proposers: [PROPOSER],
              hasServerSigner: true,
            },
            txHashes: ['0xserver'],
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <AdminProposersDialog
        open
        onOpenChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith('/admin/api/proposer-whitelists', expect.objectContaining({
        method: 'POST',
      }))
    })

    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })
})
