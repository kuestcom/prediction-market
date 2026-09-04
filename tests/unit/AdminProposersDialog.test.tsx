import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { getAddress } from 'viem'

import AdminProposersDialog from '@/app/[locale]/admin/events/calendar/_components/AdminProposersDialog'

import { hoisted, stubGlobal } from '../bun-test-helpers'

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input
  }
  return input instanceof URL ? input.href : input.url
}

const CREATOR = getAddress('0x00000000000000000000000000000000000000aa')
const EMBEDDED_ACCOUNT = getAddress('0x00000000000000000000000000000000000000bb')
const REGISTRY = getAddress('0x00000000000000000000000000000000000000cc')
const WHITELIST = getAddress('0x00000000000000000000000000000000000000dd')
const PROPOSER = getAddress('0x00000000000000000000000000000000000000ee')
const DEPLOYER = getAddress('0x00000000000000000000000000000000000000ff')

const mocks = hoisted(() => ({
  useAppKitAccount: mock(),
  useAppKitNetworkCore: mock(),
  useAppKitProvider: mock(),
  useWalletClient: mock(),
  usePublicClient: mock(),
  useUser: mock(),
  runWithSignaturePrompt: mock(),
  toastSuccess: mock(),
  toastError: mock(),
  sendTransaction: mock(),
  walletRequest: mock(),
  waitForTransactionReceipt: mock(),
  estimateFeesPerGas: mock(),
  getGasPrice: mock(),
  getCode: mock(),
  fetch: mock(),
  useIsMobile: mock(() => false),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('@reown/appkit/react', () => ({
  useAppKitAccount: () => mocks.useAppKitAccount(),
  useAppKitNetworkCore: () => mocks.useAppKitNetworkCore(),
  useAppKitProvider: () => mocks.useAppKitProvider(),
}))

void mock.module('wagmi', () => ({
  useWalletClient: () => ({ data: mocks.useWalletClient() }),
  usePublicClient: () => mocks.usePublicClient(),
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: mocks.runWithSignaturePrompt,
  }),
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}))

void mock.module('@/components/ui/button', () => ({
  Button: ({ children, nativeButton: _nativeButton, render, ...props }: any) =>
    render ?? <button {...props}>{children}</button>,
}))

void mock.module('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

void mock.module('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: any) => (open ? <div data-testid="proposers-drawer">{children}</div> : null),
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <p>{children}</p>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}))

void mock.module('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

void mock.module('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

void mock.module('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => <textarea {...props} />,
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

describe('adminProposersDialog', () => {
  beforeEach(() => {
    mocks.useAppKitAccount.mockReturnValue({ address: CREATOR })
    mocks.useAppKitNetworkCore.mockReturnValue({ chainId: 80002 })
    mocks.useAppKitProvider.mockReturnValue({ walletProvider: { request: mocks.walletRequest } })
    mocks.useUser.mockReturnValue({ address: null })
    mocks.sendTransaction.mockReset()
    mocks.walletRequest.mockReset()
    mocks.waitForTransactionReceipt.mockReset()
    mocks.estimateFeesPerGas.mockReset()
    mocks.getGasPrice.mockReset()
    mocks.getCode.mockReset()
    mocks.useIsMobile.mockReset()
    mocks.useIsMobile.mockReturnValue(false)
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
      getCode: mocks.getCode,
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
      .mockResolvedValueOnce('0xadd')
      .mockResolvedValueOnce('0xregister')
    mocks.walletRequest
      .mockResolvedValueOnce('0xdeploy')
      .mockResolvedValueOnce('0xadd')
      .mockResolvedValueOnce('0xregister')
    mocks.getCode.mockResolvedValueOnce('0x').mockResolvedValueOnce('0x1234')
    mocks.waitForTransactionReceipt
      .mockResolvedValueOnce({
        status: 'success',
        contractAddress: WHITELIST,
      })
      .mockResolvedValueOnce({
        status: 'success',
      })
      .mockResolvedValueOnce({
        status: 'success',
      })

    mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                address: DEPLOYER,
                displayName: 'Server deployer',
                shortAddress: '0x0000...00FF',
              },
            ],
          }),
        }
      }
      if (url.endsWith('/admin/api/proposer-whitelists') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            whitelistAddress: WHITELIST,
            txHashes: ['0xdeploy'],
          }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [
              {
                address: CREATOR,
                displayName: 'EOA wallet',
                shortAddress: '0x0000...00AA',
                hasServerSigner: false,
              },
            ],
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
    stubGlobal('fetch', mocks.fetch)
  })

  it('uses a drawer on mobile', () => {
    mocks.useIsMobile.mockReturnValue(true)

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    expect(screen.getByTestId('proposers-drawer')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Proposers' })).toBeInTheDocument()
  })

  it('uses the Better Auth EOA through the AppKit RPC provider when walletClient account differs', async () => {
    const user = userEvent.setup()
    mocks.useAppKitAccount.mockReturnValue({ address: null, embeddedWalletInfo: { provider: 'auth' } })
    mocks.useAppKitProvider.mockReturnValue({
      walletProvider: { request: mocks.walletRequest },
      walletProviderType: 'AUTH',
    })
    mocks.useUser.mockReturnValue({ address: CREATOR })

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.walletRequest).toHaveBeenCalledTimes(3)
    })

    expect(mocks.fetch).not.toHaveBeenCalledWith(
      '/admin/api/proposer-whitelists',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"deploy"'),
      }),
    )
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.walletRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'eth_sendTransaction',
        params: [
          expect.objectContaining({
            from: CREATOR,
            to: expect.any(String),
            data: expect.stringMatching(/^0x/i),
            value: '0x0',
          }),
        ],
      }),
    )
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      'Use the selected creator EOA in your wallet to sign this action.',
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('keeps matching wallet deployment even when a server deployer exists', async () => {
    const user = userEvent.setup()
    mocks.useWalletClient.mockReturnValue({
      account: { address: CREATOR },
      chain: { id: 80002, name: 'Polygon Amoy' },
      sendTransaction: mocks.sendTransaction,
      request: mocks.walletRequest,
    })

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.sendTransaction).toHaveBeenCalledTimes(3)
    })

    expect(mocks.fetch).not.toHaveBeenCalledWith(
      '/admin/api/proposer-whitelists',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"deploy"'),
      }),
    )
    expect(mocks.walletRequest).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('validates the AppKit provider network when social-wallet transport is used', async () => {
    const user = userEvent.setup()
    mocks.useAppKitAccount.mockReturnValue({ address: null, embeddedWalletInfo: { provider: 'auth' } })
    mocks.useAppKitNetworkCore.mockReturnValue({ chainId: 80002 })
    mocks.useAppKitProvider.mockReturnValue({
      walletProvider: { request: mocks.walletRequest },
      walletProviderType: 'AUTH',
    })
    mocks.useUser.mockReturnValue({ address: CREATOR })
    mocks.useWalletClient.mockReturnValue({
      account: { address: EMBEDDED_ACCOUNT },
      chain: { id: 1, name: 'Ethereum' },
      sendTransaction: mocks.sendTransaction,
      request: mocks.walletRequest,
    })

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.walletRequest).toHaveBeenCalledTimes(3)
    })

    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      'Switch wallet to Polygon Amoy before updating proposer whitelist.',
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('uses the embedded wallet directly even when no server deployer exists', async () => {
    const user = userEvent.setup()
    mocks.useAppKitAccount.mockReturnValue({ address: null, embeddedWalletInfo: { provider: 'auth' } })
    mocks.useAppKitProvider.mockReturnValue({
      walletProvider: { request: mocks.walletRequest },
      walletProviderType: 'AUTH',
    })
    mocks.useUser.mockReturnValue({ address: CREATOR })
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
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
            creators: [
              {
                address: CREATOR,
                displayName: 'EOA wallet',
                shortAddress: '0x0000...00AA',
                hasServerSigner: false,
              },
            ],
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

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.walletRequest).toHaveBeenCalledTimes(3)
    })

    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('sends an add transaction when re-adding the creator EOA after removal', async () => {
    const user = userEvent.setup()
    mocks.walletRequest.mockReset()
    mocks.walletRequest.mockImplementation(async (args: { method: string }) => {
      if (args.method === 'eth_chainId') {
        return '0x13882'
      }
      if (args.method === 'eth_sendTransaction') {
        return '0xadd'
      }
      throw new Error(`Unexpected wallet request: ${args.method}`)
    })

    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
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
            creators: [
              {
                address: CREATOR,
                displayName: 'EOA wallet',
                shortAddress: '0x0000...00AA',
                hasServerSigner: false,
              },
            ],
            status: {
              creator: CREATOR,
              registryAddress: REGISTRY,
              whitelistAddress: WHITELIST,
              proposers: [],
              hasServerSigner: false,
            },
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add proposers' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), CREATOR)
    await user.click(screen.getByRole('button', { name: 'Add proposers' }))

    await waitFor(() => {
      const sendCall = mocks.walletRequest.mock.calls.find(
        ([request]) =>
          request && typeof request === 'object' && (request as { method?: string }).method === 'eth_sendTransaction',
      )

      expect(sendCall).toBeDefined()
      expect(sendCall?.[0]).toEqual(
        expect.objectContaining({
          method: 'eth_sendTransaction',
          params: [
            expect.objectContaining({
              from: CREATOR,
              to: WHITELIST,
              data: expect.stringContaining('0666419d'),
              value: '0x0',
            }),
          ],
        }),
      )
    })

    expect(mocks.fetch).not.toHaveBeenCalledWith(
      '/admin/api/proposer-whitelists',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('keeps server-signer fallback available when only the stored user address matches the selected creator', async () => {
    const user = userEvent.setup()

    mocks.useAppKitAccount.mockReturnValue({ address: null })
    mocks.useAppKitProvider.mockReturnValue({ walletProvider: null })
    mocks.useUser.mockReturnValue({ address: CREATOR })
    mocks.useWalletClient.mockReturnValue(null)
    mocks.usePublicClient.mockReturnValue(null)
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
              },
            ],
          }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists?creator=')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
                hasServerSigner: true,
              },
            ],
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

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/admin/api/proposer-whitelists',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('uses the server signer for whitelist creation even when a matching wallet is connected', async () => {
    const user = userEvent.setup()

    mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
              },
            ],
          }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists?creator=')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
                hasServerSigner: true,
              },
            ],
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

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/admin/api/proposer-whitelists',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    expect(mocks.walletRequest).not.toHaveBeenCalled()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })

  it('does not treat a mismatched walletClient request method as creator wallet transport', async () => {
    const user = userEvent.setup()

    mocks.useAppKitAccount.mockReturnValue({ address: null })
    mocks.useAppKitProvider.mockReturnValue({ walletProvider: null })
    mocks.useUser.mockReturnValue({ address: CREATOR })
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input)
      if (url.includes('/admin/api/event-creations/signers')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
              },
            ],
          }),
        }
      }
      if (url.includes('/admin/api/proposer-whitelists?creator=')) {
        return {
          ok: true,
          json: async () => ({
            registryAddress: REGISTRY,
            creators: [
              {
                address: CREATOR,
                displayName: 'Server signer',
                shortAddress: '0x0000...00AA',
                hasServerSigner: true,
              },
            ],
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

    render(<AdminProposersDialog open onOpenChange={mock()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create whitelist' })).toBeEnabled()
    })

    await user.type(screen.getByRole('textbox'), PROPOSER)
    await user.click(screen.getByRole('button', { name: 'Create whitelist' }))

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/admin/api/proposer-whitelists',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    expect(mocks.walletRequest).not.toHaveBeenCalled()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Proposer whitelist updated.')
  })
})
