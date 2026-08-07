import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DirectResolutionButton from '@/app/[locale]/(platform)/event/[slug]/_components/DirectResolutionButton'
import { NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS } from '@/lib/contracts'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  readContract: vi.fn(),
  readWhitelist: vi.fn(),
  runWithSignaturePrompt: vi.fn(),
  signAndSubmit: vi.fn(),
  signTypedDataAsync: vi.fn(),
  user: {
    id: 'user-1',
    address: '0x1111111111111111111111111111111111111111',
    deposit_wallet_address: '0x5555555555555555555555555555555555555555',
    deposit_wallet_status: 'deployed',
    image: '',
  },
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

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => ({ readContract: mocks.readContract }),
  useSignTypedData: () => ({ signTypedDataAsync: mocks.signTypedDataAsync }),
  useWalletClient: () => ({ data: {} }),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.user,
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
    mocks.user.id = 'user-1'
    mocks.user.address = '0x1111111111111111111111111111111111111111'
    mocks.user.deposit_wallet_address = '0x5555555555555555555555555555555555555555'
    mocks.user.deposit_wallet_status = 'deployed'
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

  it('reuses the prefetched report summary when the dialog opens', async () => {
    const onResolutionRewardAmountChange = vi.fn()

    render(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith('$4'))
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.readContract).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(mocks.readWhitelist).toHaveBeenCalledOnce())

    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.readContract).toHaveBeenCalledOnce()
  })

  it('loads the reward badge for NegRisk direct-resolution markets', async () => {
    const onResolutionRewardAmountChange = vi.fn()
    const negRiskRequestId = `0x${'d'.repeat(64)}`
    const negRiskMarket = {
      ...(market as any),
      neg_risk: true,
      neg_risk_request_id: negRiskRequestId,
    } as never

    render(
      <DirectResolutionButton
        market={negRiskMarket}
        event={{ ...(event as any), markets: [negRiskMarket] }}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith('$4'))
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS,
        args: [negRiskRequestId],
      }),
    )
  })

  it('does not load a reward badge after the market is resolved', async () => {
    const onResolutionRewardAmountChange = vi.fn()
    const resolvedMarket = {
      ...(market as any),
      is_active: false,
      is_resolved: true,
      condition: { ...(market as any).condition, resolved: true },
    } as never

    render(
      <DirectResolutionButton
        market={resolvedMarket}
        event={{ ...(event as any), markets: [resolvedMarket] }}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith(null))
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.readContract).not.toHaveBeenCalled()
  })

  it('hides the reward badge when the on-chain rewards market is inactive', async () => {
    const onResolutionRewardAmountChange = vi.fn()
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '4000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: false,
        outcomeCounts: { yes: 0, no: 0, unknown: 0 },
        reporters: [],
        currentOutcome: null,
        eligibility: 'ineligible',
      }),
    })

    render(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())
    expect(onResolutionRewardAmountChange).toHaveBeenCalledWith(null)
    expect(onResolutionRewardAmountChange).not.toHaveBeenCalledWith('$4')
  })

  it('ignores an obsolete report summary after the market changes', async () => {
    let resolveFirstResponse!: (response: Response) => void
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirstResponse = resolve
    })
    mocks.fetch
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          marketId: `0x${'b'.repeat(64)}`,
          bond: '300000000',
          rewardPool: '8000000',
          lockDuration: '172800',
          withdrawalDelay: '86400',
          rewardEnabled: true,
          outcomeCounts: { yes: 0, no: 0, unknown: 0 },
          reporters: [],
          currentOutcome: null,
          eligibility: 'eligible',
        }),
      })
    const onResolutionRewardAmountChange = vi.fn()
    const { rerender } = render(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())

    const nextMarket = {
      ...(market as any),
      condition_id: 'condition-2',
      question_id: `0x${'d'.repeat(64)}`,
    } as never
    const nextEvent = { ...(event as any), id: 'event-2', slug: 'event-2', markets: [nextMarket] } as never
    rerender(
      <DirectResolutionButton
        market={nextMarket}
        event={nextEvent}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith('$8'))

    await act(async () => {
      resolveFirstResponse({
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
      } as Response)
      await Promise.resolve()
    })
    expect(onResolutionRewardAmountChange).not.toHaveBeenCalledWith('$4')
  })

  it('invalidates the report summary when the authenticated identity changes', async () => {
    const onResolutionRewardAmountChange = vi.fn()
    const { rerender } = render(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith('$4'))
    expect(mocks.fetch).toHaveBeenCalledOnce()

    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        marketId: `0x${'a'.repeat(64)}`,
        bond: '300000000',
        rewardPool: '8000000',
        lockDuration: '172800',
        withdrawalDelay: '86400',
        rewardEnabled: true,
        outcomeCounts: { yes: 0, no: 1, unknown: 0 },
        reporters: [],
        currentOutcome: 'no',
        eligibility: 'eligible',
      }),
    })
    mocks.user.id = 'user-2'
    mocks.user.address = '0x6666666666666666666666666666666666666666'
    mocks.user.deposit_wallet_address = '0x7777777777777777777777777777777777777777'

    rerender(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenCalledWith('$8'))

    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))
    const dialog = await screen.findByRole('dialog')
    const selectedOutcome = await within(dialog).findByRole('button', { name: /No/ })
    expect(selectedOutcome).toHaveAttribute('aria-pressed', 'true')
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

  it.each(['signed', 'deploying'])(
    'keeps proposal submission disabled while the Deposit Wallet is %s',
    async (status) => {
      mocks.user.deposit_wallet_status = status
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
      fireEvent.click(within(dialog).getByRole('checkbox', { name: /I have read the market rules/ }))

      expect(within(dialog).getByRole('button', { name: 'Propose resolution' })).toBeDisabled()
      expect(screen.queryByRole('dialog', { name: 'Review proposal' })).not.toBeInTheDocument()
    },
  )

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

  it('explains when the rewards contract no longer accepts proposals', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onResolutionRewardAmountChange = vi.fn()
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
    mocks.signAndSubmit.mockResolvedValue({
      error:
        'wallet execution error: Contract call reverted with data: 0xb09725d200000000000000000000000000000000000000000000000000000000000000010000000000000000000000001eedf578442f4c52429bb2b6449ff0872ae73be100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004b521771a00000000000000000000000000000000000000000000000000000000',
    })

    render(
      <DirectResolutionButton
        market={market}
        event={event}
        onResolutionRewardAmountChange={onResolutionRewardAmountChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /Yes/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I have read the market rules/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Propose resolution' }))

    const confirmationDialog = await screen.findByRole('dialog', { name: 'Review proposal' })
    fireEvent.click(within(confirmationDialog).getByRole('button', { name: 'Lock $300 and propose Yes' }))

    await waitFor(() => expect(screen.getAllByText('This market is already resolved.').length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Review proposal' })).not.toBeInTheDocument())
    await waitFor(() => expect(onResolutionRewardAmountChange).toHaveBeenLastCalledWith(null))
    expect(screen.queryByText(/b521771a/)).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})
