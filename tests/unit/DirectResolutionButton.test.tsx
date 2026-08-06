import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DirectResolutionButton from '@/app/[locale]/(platform)/event/[slug]/_components/DirectResolutionButton'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  readContract: vi.fn(),
  readWhitelist: vi.fn(),
  runWithSignaturePrompt: vi.fn(),
  signAndSubmit: vi.fn(),
  signTypedDataAsync: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (translated, [key, replacement]) => translated.replaceAll(`{${key}}`, replacement),
      value,
    ),
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => ({ readContract: mocks.readContract }),
  useSignTypedData: () => ({ signTypedDataAsync: mocks.signTypedDataAsync }),
  useWalletClient: () => ({ data: {} }),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => ({
    id: 'user-1',
    address: '0x1111111111111111111111111111111111111111',
    deposit_wallet_address: '0x5555555555555555555555555555555555555555',
    deposit_wallet_status: 'deployed',
    image: '',
  }),
}))

vi.mock('@/lib/wallet/client', () => ({
  signAndSubmitDepositWalletCalls: mocks.signAndSubmit,
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ polygonRpcUrl: '' }),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: mocks.runWithSignaturePrompt }),
}))

vi.mock('@/lib/proposer-whitelist', () => ({
  readCreatorProposerWhitelistStatus: mocks.readWhitelist,
}))

const market = {
  condition_id: 'condition-1',
  question_id: `0x${'c'.repeat(64)}`,
  title: 'Will this happen?',
  question: 'Will this happen?',
  metadata: JSON.stringify({ resolution_type: 'dro_moov2' }),
  neg_risk: false,
  is_resolved: false,
  is_active: true,
  price: 0.55,
  outcomes: [
    { outcome_index: 0, outcome_text: 'Yes', price: 0.55 },
    { outcome_index: 1, outcome_text: 'No', price: 0.45 },
  ],
  condition: {
    oracle: '0x2222222222222222222222222222222222222222',
    resolved: false,
  },
} as never

const event = {
  id: 'event-1',
  slug: 'event-slug',
  title: 'Will this happen?',
  creator: '0x3333333333333333333333333333333333333333',
  icon_url: '',
  rules: 'Resolve according to the official result.',
  markets: [market],
} as never

describe('DirectResolutionButton', () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    mocks.readContract.mockReset()
    mocks.readWhitelist.mockReset()
    mocks.runWithSignaturePrompt.mockReset()
    mocks.signAndSubmit.mockReset()
    mocks.signTypedDataAsync.mockReset()
    mocks.readWhitelist.mockResolvedValue({
      whitelistAddress: '0x4444444444444444444444444444444444444444',
      proposers: [],
    })
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '4000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: true,
        outcomeCounts: { yes: 1, no: 0, unknown: 0 },
        reporters: [],
        currentOutcome: 'yes',
        eligibility: 'eligible',
      }),
    })
    mocks.readContract.mockResolvedValue({
      requestTimestamp: 1n,
      resolved: false,
      ancillaryData: '0x1234',
    })
    mocks.runWithSignaturePrompt.mockImplementation(async (callback: () => Promise<unknown>) => callback())
    mocks.signAndSubmit.mockResolvedValue({ error: null, txHash: `0x${'b'.repeat(64)}` })
    vi.stubGlobal('fetch', mocks.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps an existing proposal selected and removes submission controls', async () => {
    render(<DirectResolutionButton market={market} event={event} />)

    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('Inconclusive result')).not.toBeInTheDocument()
    const selectedOutcome = await within(dialog).findByRole('button', { name: /Yes/ })
    await waitFor(() => expect(selectedOutcome).toBeDisabled())

    expect(selectedOutcome).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('button', { name: 'Propose resolution' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Rules')).toBeInTheDocument()
  })

  it('shows the inconclusive option only after final-resolution access is confirmed', async () => {
    let resolveWhitelist!: (value: { whitelistAddress: string; proposers: string[] }) => void
    mocks.readWhitelist.mockReturnValue(
      new Promise((resolve) => {
        resolveWhitelist = resolve
      }),
    )

    render(<DirectResolutionButton market={market} event={event} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('Inconclusive result')).not.toBeInTheDocument()

    resolveWhitelist({
      whitelistAddress: '0x4444444444444444444444444444444444444444',
      proposers: ['0x1111111111111111111111111111111111111111'],
    })

    expect((await within(dialog).findAllByText('Inconclusive result')).length).toBeGreaterThan(0)
  })

  it('shows reporter accuracy to an approved resolver', async () => {
    mocks.readWhitelist.mockResolvedValue({
      whitelistAddress: '0x4444444444444444444444444444444444444444',
      proposers: ['0x1111111111111111111111111111111111111111'],
    })
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '4000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: true,
        outcomeCounts: { yes: 1, no: 0, unknown: 0 },
        reporters: [
          {
            seed: '0x5555555555555555555555555555555555555555',
            image: '',
            outcome: 'yes',
            historyCorrectCount: 4,
            historyIncorrectCount: 1,
          },
        ],
        currentOutcome: null,
        eligibility: 'eligible',
      }),
    })

    render(<DirectResolutionButton market={market} event={event} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByLabelText('4 Correct')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('1 Incorrect')).toBeInTheDocument()
  })

  it('locks the proposal CTA immediately after a successful submission', async () => {
    let summaryRequests = 0
    const pendingSummary = new Promise<Response>(() => undefined)
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'report-1', outcome: 'yes', updatedAt: new Date().toISOString() }),
        })
      }

      summaryRequests += 1
      if (summaryRequests === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            marketId: `0x${'a'.repeat(64)}`,
            bond: '300000000',
            rewardPool: '4000000',
            lockDuration: '172800',
            withdrawalDelay: '86400',
            rewardEnabled: true,
            outcomeCounts: { yes: 0, no: 0, unknown: 0 },
            reporters: [],
            currentOutcome: null,
            eligibility: 'eligible',
          }),
        })
      }
      return pendingSummary
    })

    render(<DirectResolutionButton market={market} event={event} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Bond at risk: $300')).toBeInTheDocument()
    expect(within(dialog).getByText('Reward: $4')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Propose the outcome once it can be verified. Earn the reward if confirmed.'),
    ).toBeInTheDocument()
    fireEvent.click(await within(dialog).findByRole('button', { name: /Yes/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I have read the market rules/ }))
    const submitButton = within(dialog).getByRole('button', { name: 'Propose resolution' })
    await waitFor(() => expect(submitButton).toBeEnabled())
    fireEvent.click(submitButton)

    const confirmationDialog = await screen.findByRole('dialog', { name: 'Review proposal' })
    expect(within(confirmationDialog).getByText('Your proposal')).toBeInTheDocument()
    expect(within(confirmationDialog).getByText('Yes 55%')).toBeInTheDocument()
    expect(within(confirmationDialog).getByText('$304 returned')).toBeInTheDocument()
    expect(within(confirmationDialog).queryByText(/Withdrawal opens/)).not.toBeInTheDocument()
    fireEvent.click(within(confirmationDialog).getByRole('button', { name: 'Lock $300 and propose Yes' }))

    await waitFor(() => expect(mocks.signAndSubmit).toHaveBeenCalledOnce())
    expect(submitButton).toBeDisabled()
  })

  it('opens the rules when the proposal CTA is clicked before acceptance', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '4000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: true,
        outcomeCounts: { yes: 0, no: 0, unknown: 0 },
        reporters: [],
        currentOutcome: null,
        eligibility: 'eligible',
      }),
    })

    render(<DirectResolutionButton market={market} event={event} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /Yes/ }))

    const submitButton = within(dialog).getByRole('button', { name: 'Propose resolution' })
    await waitFor(() => expect(submitButton).toBeEnabled())
    expect(within(dialog).queryByText('Accept the market rules to continue.')).not.toBeInTheDocument()

    fireEvent.click(submitButton)

    expect(within(dialog).getByText('Rules').closest('details')).toHaveAttribute('open')
    expect(within(dialog).getByText('Accept the market rules to continue.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Review proposal' })).not.toBeInTheDocument()
  })

  it('does not expose Viem details when the wallet rejects the proposal', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '4000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: true,
        outcomeCounts: { yes: 0, no: 0, unknown: 0 },
        reporters: [],
        currentOutcome: null,
        eligibility: 'eligible',
      }),
    })
    mocks.signAndSubmit.mockRejectedValue(
      new Error('User rejected the request. Details: User rejected the request. Version: viem@2.55.10'),
    )

    render(<DirectResolutionButton market={market} event={event} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /Yes/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I have read the market rules/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Propose resolution' }))

    const confirmationDialog = await screen.findByRole('dialog', { name: 'Review proposal' })
    fireEvent.click(within(confirmationDialog).getByRole('button', { name: 'Lock $300 and propose Yes' }))

    await waitFor(() => expect(screen.getAllByText('Wallet signature was rejected.').length).toBeGreaterThan(0))
    expect(screen.queryByText(/viem@2\.55\.10/)).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})
