import { describe, expect, it } from 'vitest'

import type {
  FormState,
  PendingRequestItem,
  PrepareResponse,
} from '@/app/[locale]/admin/events/calendar/_components/admin-create-event-form-types'

import {
  buildCategorySlugSet,
  mergeCategoryItems,
  removeGeneratedCategoryItems,
} from '@/app/[locale]/admin/events/calendar/_components/admin-create-event-form-category-helpers'
import {
  buildLoadedSignaturePlan,
  buildSignatureExecutionTxs,
  getCheckIndicatorState,
  isEmbeddedWalletProvider,
  resolveChainId,
} from '@/app/[locale]/admin/events/calendar/_components/admin-create-event-form-signature-helpers'
import {
  buildRpcTransactionRequest,
  createInitialForm,
  isBigIntSerializationError,
  mapSignatureFlowErrorForUser,
} from '@/app/[locale]/admin/events/calendar/_components/admin-create-event-form-utils'
import { buildStepErrors } from '@/app/[locale]/admin/events/calendar/_components/admin-create-event-form-validation'
import { createInitialAdminSportsForm } from '@/lib/admin-sports-create'

function buildValidForm(overrides: Partial<FormState> = {}): FormState {
  return {
    ...createInitialForm({
      title: 'Will BTC close above $100k?',
      slug: 'btc-close-above-100k',
      endDateIso: '2099-01-01T12:00',
    }),
    mainCategorySlug: 'crypto',
    categories: [
      { label: 'Bitcoin', slug: 'bitcoin' },
      { label: 'Crypto', slug: 'crypto-markets' },
      { label: 'Prices', slug: 'prices' },
      { label: 'January', slug: 'january' },
    ],
    marketMode: 'binary',
    binaryQuestion: 'Will BTC close above $100k?',
    binaryOutcomeYes: 'Yes',
    binaryOutcomeNo: 'No',
    resolutionSource: 'https://example.com/btc',
    resolutionRules: `
      Resolve YES if the referenced BTC price source closes above $100,000 before the deadline.
      Otherwise resolve NO after the market deadline.
    `,
    ...overrides,
  }
}

function buildValidationArgs(
  overrides: Partial<Parameters<typeof buildStepErrors>[1]> = {},
): Parameters<typeof buildStepErrors>[1] {
  return {
    form: buildValidForm(),
    creationMode: 'single',
    sportsForm: createInitialAdminSportsForm(),
    hasEventImage: true,
    hasTeamLogoByHostStatus: {
      home: true,
      away: true,
    },
    slugValidationState: 'unique',
    fundingCheckState: 'ok',
    nativeGasCheckState: 'ok',
    allowedCreatorCheckState: 'ok',
    proposerWhitelistCheckState: 'ok',
    openRouterCheckState: 'ok',
    contentCheckState: 'ok',
    hasPendingAiErrors: false,
    hasContentCheckFatalError: false,
    allowPastResolutionDate: false,
    hasCreatorSelection: true,
    hasRecurringCadence: true,
    hasRecurringSeries: true,
    recurringPreviewErrors: [],
    ...overrides,
  }
}

describe('admin create event form utils', () => {
  describe('isBigIntSerializationError', () => {
    it('detects provider bigint serialization failures', () => {
      expect(isBigIntSerializationError('Do not know how to serialize a BigInt')).toBe(true)
      expect(isBigIntSerializationError('Failed to parse String to BigInt')).toBe(true)
      expect(isBigIntSerializationError('Cannot convert 78.000000075 to a BigInt')).toBe(true)
    })

    it('ignores unrelated errors', () => {
      expect(isBigIntSerializationError('insufficient funds for gas * price + value')).toBe(false)
    })
  })

  describe('buildRpcTransactionRequest', () => {
    it('serializes value and fee overrides as hex for eth_sendTransaction', () => {
      expect(
        buildRpcTransactionRequest({
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          data: '0x1234',
          value: 0n,
          maxFeePerGas: 78_000_000_075n,
          maxPriorityFeePerGas: 78_000_000_000n,
        }),
      ).toEqual({
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        data: '0x1234',
        value: '0x0',
        maxFeePerGas: '0x1229298c4b',
        maxPriorityFeePerGas: '0x1229298c00',
      })
    })
  })

  describe('mapSignatureFlowErrorForUser', () => {
    it('maps bigint parsing failures to the wallet provider guidance', () => {
      expect(mapSignatureFlowErrorForUser('Failed to parse String to BigInt')).toBe(
        'Could not send transaction with this wallet provider. Please retry or switch wallet.',
      )
    })
  })

  describe('category helpers', () => {
    it('dedupes categories by normalized slug while preserving first-seen values', () => {
      expect(
        mergeCategoryItems(
          [
            { label: ' Bitcoin ', slug: ' Bitcoin ' },
            { label: '', slug: 'empty-label' },
          ],
          [
            { label: 'Duplicate bitcoin', slug: 'bitcoin' },
            { label: 'Macro', slug: 'macro' },
          ],
        ),
      ).toEqual([
        { label: 'Bitcoin', slug: 'Bitcoin' },
        { label: 'Macro', slug: 'macro' },
      ])
    })

    it('removes generated categories by normalized slug', () => {
      const generatedSlugs = buildCategorySlugSet([{ label: 'Sports', slug: ' Sports ' }])

      expect(
        removeGeneratedCategoryItems(
          [
            { label: 'Sports duplicate', slug: 'sports' },
            { label: 'NBA', slug: 'nba' },
          ],
          generatedSlugs,
        ),
      ).toEqual([{ label: 'NBA', slug: 'nba' }])
    })
  })

  describe('signature helpers', () => {
    const prepared: PrepareResponse = {
      requestId: 'request-1',
      chainId: 80002,
      creator: '0x1111111111111111111111111111111111111111',
      txPlan: [
        {
          id: 'initialize',
          to: '0x2222222222222222222222222222222222222222',
          value: '0',
          data: '0x',
          description: 'Initialize market',
        },
        {
          id: 'approve',
          to: '0x3333333333333333333333333333333333333333',
          value: '0',
          data: '0x',
          description: 'Approve reward token',
        },
      ],
    }

    it('marks already confirmed transaction plan items as successful', () => {
      expect(buildSignatureExecutionTxs(prepared, [{ id: 'approve', hash: '0xabc' }])).toEqual([
        expect.objectContaining({
          id: 'initialize',
          status: 'idle',
          hash: undefined,
        }),
        expect.objectContaining({
          id: 'approve',
          status: 'success',
          hash: '0xabc',
        }),
      ])
    })

    it('loads metadata update plans for pending finalize requests', () => {
      const pending: PendingRequestItem = {
        requestId: 'request-1',
        payloadHash: 'hash-1',
        status: 'metadata_update_pending',
        creator: '0x1111111111111111111111111111111111111111',
        chainId: 80002,
        expiresAt: Date.now() + 60_000,
        updatedAt: Date.now(),
        errorMessage: null,
        prepared,
        txs: [{ id: 'metadata-update', hash: '0xdef' }],
        metadataUpdateTxPlan: [
          {
            id: 'metadata-update',
            to: '0x4444444444444444444444444444444444444444',
            value: '0',
            data: '0x1234',
            description: 'Update metadata',
          },
        ],
      }

      expect(buildLoadedSignaturePlan(pending)).toEqual(
        expect.objectContaining({
          pending,
          prepared: expect.objectContaining({
            txPlan: pending.metadataUpdateTxPlan,
          }),
          signatureTxs: [
            expect.objectContaining({
              id: 'metadata-update',
              status: 'success',
              hash: '0xdef',
            }),
          ],
        }),
      )
    })

    it('detects embedded wallet providers and normalizes chain ids', () => {
      const rpcProvider = {
        request: async () => null,
      }
      const embeddedProvider = {
        ...rpcProvider,
        connectEmail: () => {},
        connectSocial: () => {},
        getEmail: () => 'admin@example.com',
        switchNetwork: () => {},
      }

      expect(isEmbeddedWalletProvider(rpcProvider)).toBe(false)
      expect(isEmbeddedWalletProvider(embeddedProvider)).toBe(true)
      expect(resolveChainId('80002')).toBe(80002)
      expect(resolveChainId('not-a-chain')).toBeNull()
      expect(getCheckIndicatorState('checking')).toBe('checking')
      expect(getCheckIndicatorState('unique', 'unique')).toBe('ok')
    })
  })

  describe('buildStepErrors', () => {
    it('keeps a complete single event valid through all wizard steps', () => {
      expect(buildStepErrors(1, buildValidationArgs())).toEqual([])
      expect(buildStepErrors(2, buildValidationArgs())).toEqual([])
      expect(buildStepErrors(3, buildValidationArgs())).toEqual([])
      expect(buildStepErrors(4, buildValidationArgs())).toEqual([])
    })

    it('preserves required step one checks for title, image, and categories', () => {
      const errors = buildStepErrors(
        1,
        buildValidationArgs({
          form: buildValidForm({
            title: '',
            categories: [],
          }),
          hasEventImage: false,
        }),
      )

      expect(errors).toEqual(
        expect.arrayContaining([
          'Event title is required.',
          'Event image is required.',
          'Select at least 4 sub categories.',
        ]),
      )
    })

    it('requires a recurrence group for recurring events', () => {
      expect(
        buildStepErrors(
          1,
          buildValidationArgs({
            creationMode: 'recurring',
            hasRecurringSeries: false,
          }),
        ),
      ).toContain('Select or name the recurrence group.')
    })

    it('preserves resolution source and rules validation on step three', () => {
      expect(
        buildStepErrors(
          3,
          buildValidationArgs({
            form: buildValidForm({
              resolutionSource: 'not-a-url',
              resolutionRules: 'Too short.',
            }),
          }),
        ),
      ).toEqual(['Resolution source URL is invalid.', 'Resolution rules are too short.'])
    })

    it('keeps pre-sign checks blocking step four until they pass', () => {
      expect(
        buildStepErrors(
          4,
          buildValidationArgs({
            fundingCheckState: 'idle',
            openRouterCheckState: 'idle',
          }),
        ),
      ).toEqual(expect.arrayContaining(['Run the EOA USDC check first.', 'Run OpenRouter check first.']))
    })
  })
})
