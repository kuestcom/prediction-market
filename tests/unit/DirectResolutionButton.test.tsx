import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DirectResolutionButton from '@/app/[locale]/(platform)/event/[slug]/_components/DirectResolutionButton'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  readWhitelist: vi.fn(),
  runWithSignaturePrompt: vi.fn(),
  signMessageAsync: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => ({}),
  useSignMessage: () => ({ signMessageAsync: mocks.signMessageAsync }),
  useWalletClient: () => ({ data: {} }),
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
  title: 'Will this happen?',
  question: 'Will this happen?',
  metadata: JSON.stringify({ resolution_type: 'dro_moov2' }),
  neg_risk: false,
  is_resolved: false,
  is_active: true,
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
    mocks.readWhitelist.mockReset()
    mocks.runWithSignaturePrompt.mockReset()
    mocks.signMessageAsync.mockReset()
    mocks.readWhitelist.mockResolvedValue({
      whitelistAddress: '0x4444444444444444444444444444444444444444',
      proposers: [],
    })
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        outcomeCounts: { yes: 1, no: 0, unknown: 0 },
        reporters: [],
        currentOutcome: 'yes',
        eligibility: 'eligible',
      }),
    })
    mocks.runWithSignaturePrompt.mockImplementation(async (callback: () => Promise<unknown>) => callback())
    mocks.signMessageAsync.mockResolvedValue(`0x${'1'.repeat(130)}`)
    vi.stubGlobal('fetch', mocks.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps an existing proposal selected and removes submission controls', async () => {
    render(<DirectResolutionButton market={market} event={event} />)

    fireEvent.click(screen.getByRole('button', { name: 'Propose resolution' }))

    const dialog = await screen.findByRole('dialog')
    const selectedOutcome = await within(dialog).findByRole('button', { name: /Yes/ })
    await waitFor(() => expect(selectedOutcome).toBeDisabled())

    expect(selectedOutcome).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('button', { name: 'Propose resolution' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Rules')).toBeInTheDocument()
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
    fireEvent.click(await within(dialog).findByRole('button', { name: /Yes/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I have read the market rules/ }))
    const submitButton = within(dialog).getByRole('button', { name: 'Propose resolution' })
    await waitFor(() => expect(submitButton).toBeEnabled())
    fireEvent.click(submitButton)

    await waitFor(() => expect(summaryRequests).toBe(2))
    expect(submitButton).toBeDisabled()
  })
})
