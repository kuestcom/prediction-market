'use client'

import type { Address, Hash, Hex } from 'viem'
import type { SignerOption } from './admin-create-event-form-types'
import type { ProposerWhitelistCreatorOption, ProposerWhitelistMutationResponse, ProposerWhitelistStatus, ProposerWhitelistStatusResponse } from '@/lib/proposer-whitelist'
import { useAppKitAccount } from '@reown/appkit/react'
import { CheckCircle2Icon, CircleIcon, Loader2Icon, PlusIcon, UserCheckIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { encodeDeployData, encodeFunctionData, getAddress, isAddress, toHex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import {
  isProposerWhitelistStatusResponse,
  normalizeProposerAddressList,
  readProposerWhitelistError,
  resolveProposerWhitelistAddress,
  shortenProposerWhitelistAddress,
} from '@/lib/proposer-whitelist'
import {
  CREATOR_PROPOSER_WHITELIST_ABI,
  CREATOR_PROPOSER_WHITELIST_BYTECODE,
  CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
} from '@/lib/proposer-whitelist-contracts'
import { sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'
import { cn } from '@/lib/utils'
import { defaultViemNetwork } from '@/lib/viem-network'
import { useUser } from '@/stores/useUser'
import { isBigIntSerializationError } from './admin-create-event-form-utils'

interface AdminProposersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCreatorAddress?: string | null
  lockCreatorSelection?: boolean
  onStatusChange?: (status: ProposerWhitelistStatus) => void
}

interface EventCreationSignersResponse {
  data?: SignerOption[]
}

function readApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.trim() ? maybeError.trim() : null
}

function mergeCreatorOptions(input: {
  creators: ProposerWhitelistCreatorOption[]
  signers: SignerOption[]
  connectedAddress: Address | null
  connectedLabel: string
}) {
  const byAddress = new Map<string, ProposerWhitelistCreatorOption>()
  for (const creator of input.creators) {
    byAddress.set(creator.address.toLowerCase(), creator)
  }

  for (const signer of input.signers) {
    if (!isAddress(signer.address)) {
      continue
    }
    const address = getAddress(signer.address) as Address
    const key = address.toLowerCase()
    const existing = byAddress.get(key)
    byAddress.set(key, {
      address,
      displayName: signer.displayName || existing?.displayName || signer.shortAddress,
      shortAddress: signer.shortAddress || existing?.shortAddress || shortenProposerWhitelistAddress(address),
      hasServerSigner: true,
    })
  }

  if (input.connectedAddress) {
    const key = input.connectedAddress.toLowerCase()
    const existing = byAddress.get(key)
    byAddress.set(key, {
      address: input.connectedAddress,
      displayName: existing?.displayName ?? input.connectedLabel,
      shortAddress: shortenProposerWhitelistAddress(input.connectedAddress),
      hasServerSigner: Boolean(existing?.hasServerSigner),
    })
  }

  return [...byAddress.values()]
}

function getLockedCreatorOption(input: {
  creators: ProposerWhitelistCreatorOption[]
  signers: SignerOption[]
  initialCreatorAddress?: string | null
  connectedAddress: Address | null
  connectedLabel: string
}) {
  if (!input.initialCreatorAddress || !isAddress(input.initialCreatorAddress)) {
    return []
  }

  const merged = mergeCreatorOptions({
    creators: input.creators,
    signers: input.signers,
    connectedAddress: input.connectedAddress,
    connectedLabel: input.connectedLabel,
  })
  const lockedAddress = getAddress(input.initialCreatorAddress) as Address
  const existing = merged.find(creator => creator.address.toLowerCase() === lockedAddress.toLowerCase())
  if (existing) {
    return [existing]
  }

  return [{
    address: lockedAddress,
    displayName: input.connectedAddress?.toLowerCase() === lockedAddress.toLowerCase()
      ? input.connectedLabel
      : shortenProposerWhitelistAddress(lockedAddress),
    shortAddress: shortenProposerWhitelistAddress(lockedAddress),
    hasServerSigner: input.signers.some(signer => isAddress(signer.address) && signer.address.toLowerCase() === lockedAddress.toLowerCase()),
  } satisfies ProposerWhitelistCreatorOption]
}

function isMutationResponse(payload: unknown): payload is ProposerWhitelistMutationResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as Partial<ProposerWhitelistMutationResponse>
  return Boolean(candidate.status) && Array.isArray(candidate.txHashes)
}

function getPreferredCreator(input: {
  initialCreatorAddress?: string | null
  selectedCreator: Address | null
  connectedAddress: Address | null
  creators: ProposerWhitelistCreatorOption[]
}) {
  if (input.selectedCreator) {
    return input.selectedCreator
  }
  if (input.initialCreatorAddress && isAddress(input.initialCreatorAddress)) {
    return getAddress(input.initialCreatorAddress) as Address
  }
  if (input.connectedAddress) {
    return input.connectedAddress
  }
  return input.creators[0]?.address ?? null
}

function buildRpcWalletTransactionRequest(params: {
  from: `0x${string}`
  data: `0x${string}`
  to?: `0x${string}`
  value?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}) {
  const request: {
    from: `0x${string}`
    data: `0x${string}`
    to?: `0x${string}`
    value: Hex
    maxFeePerGas?: Hex
    maxPriorityFeePerGas?: Hex
  } = {
    from: params.from,
    data: params.data,
    value: toHex(params.value ?? 0n),
  }

  if (params.to) {
    request.to = params.to
  }

  if (typeof params.maxFeePerGas === 'bigint') {
    request.maxFeePerGas = toHex(params.maxFeePerGas)
  }

  if (typeof params.maxPriorityFeePerGas === 'bigint') {
    request.maxPriorityFeePerGas = toHex(params.maxPriorityFeePerGas)
  }

  return request
}

export default function AdminProposersDialog({
  open,
  onOpenChange,
  initialCreatorAddress,
  lockCreatorSelection = false,
  onStatusChange,
}: AdminProposersDialogProps) {
  const t = useExtracted()
  const { address: appKitAddressRaw } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const user = useUser()
  const connectedWalletAddress = useMemo(
    () => resolveProposerWhitelistAddress(appKitAddressRaw, walletClient?.account?.address),
    [appKitAddressRaw, walletClient?.account?.address],
  )
  const knownCreatorAddress = useMemo(
    () => resolveProposerWhitelistAddress(appKitAddressRaw, user?.address, walletClient?.account?.address),
    [appKitAddressRaw, user?.address, walletClient?.account?.address],
  )
  const [creators, setCreators] = useState<ProposerWhitelistCreatorOption[]>([])
  const [signers, setSigners] = useState<SignerOption[]>([])
  const [selectedCreator, setSelectedCreator] = useState<Address | null>(null)
  const [status, setStatus] = useState<ProposerWhitelistStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [walletInput, setWalletInput] = useState('')

  const creatorOptions = useMemo(() => {
    if (lockCreatorSelection) {
      return getLockedCreatorOption({
        creators,
        signers,
        initialCreatorAddress,
        connectedAddress: knownCreatorAddress,
        connectedLabel: t('EOA wallet'),
      })
    }

    return mergeCreatorOptions({
      creators,
      signers,
      connectedAddress: knownCreatorAddress,
      connectedLabel: t('EOA wallet'),
    })
  }, [creators, initialCreatorAddress, knownCreatorAddress, lockCreatorSelection, signers, t])
  const selectedOption = creatorOptions.find(item => selectedCreator && item.address.toLowerCase() === selectedCreator.toLowerCase()) ?? null
  const canUseConnectedWallet = Boolean(
    selectedCreator
    && connectedWalletAddress
    && selectedCreator.toLowerCase() === connectedWalletAddress.toLowerCase(),
  )
  const canUseServerSigner = Boolean(status?.hasServerSigner || selectedOption?.hasServerSigner)
  const isSwitchingCreator = Boolean(
    isLoading
    && selectedCreator
    && status
    && status.creator.toLowerCase() !== selectedCreator.toLowerCase(),
  )

  function readDialogError(error: unknown) {
    const message = readProposerWhitelistError(error)

    if (message === 'Creator wallet needs POL for gas before updating proposer whitelist.') {
      return t('Creator wallet needs POL for gas before updating proposer whitelist.')
    }
    if (message === 'Transaction could not be sent because the gas fee is below the current network minimum.') {
      return t('Transaction could not be sent because the gas fee is below the current network minimum.')
    }
    if (message === 'Wallet signature was rejected.') {
      return t('Wallet signature was rejected.')
    }
    if (message === 'Only the selected creator wallet can update this whitelist.') {
      return t('Only the selected creator wallet can update this whitelist.')
    }
    if (message === 'Zero address is not allowed.') {
      return t('Zero address is not allowed.')
    }
    if (message === 'Whitelist creator does not match the selected creator wallet.') {
      return t('Whitelist creator does not match the selected creator wallet.')
    }
    if (message === 'Could not update proposer whitelist.') {
      return t('Could not update proposer whitelist.')
    }

    return message
  }

  const loadSigners = useCallback(async () => {
    try {
      const response = await fetch('/admin/api/event-creations/signers', {
        method: 'GET',
        cache: 'no-store',
      })
      if (!response.ok) {
        setSigners([])
        return [] as SignerOption[]
      }

      const payload = await response.json().catch(() => null) as EventCreationSignersResponse | null
      const nextSigners = Array.isArray(payload?.data) ? payload.data : []
      setSigners(nextSigners)
      return nextSigners
    }
    catch (error) {
      console.error('Failed to load event creation signers for proposer whitelist dialog', error)
      setSigners([])
      return [] as SignerOption[]
    }
  }, [])

  const loadStatus = useCallback(async (creator: Address | null, nextSigners: SignerOption[] = signers) => {
    setIsLoading(true)
    try {
      const query = creator ? `?creator=${encodeURIComponent(creator)}` : ''
      const response = await fetch(`/admin/api/proposer-whitelists${query}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isProposerWhitelistStatusResponse(payload)) {
        throw new Error(apiError || t('Could not load proposer whitelist ({status})', { status: String(response.status) }))
      }

      const nextPayload: ProposerWhitelistStatusResponse = payload
      setCreators(nextPayload.creators)
      setStatus(nextPayload.status)
      if (nextPayload.status) {
        onStatusChange?.(nextPayload.status)
      }

      const availableCreators = mergeCreatorOptions({
        creators: nextPayload.creators,
        signers: nextSigners,
        connectedAddress: knownCreatorAddress,
        connectedLabel: t('EOA wallet'),
      })
      const preferred = getPreferredCreator({
        initialCreatorAddress,
        selectedCreator: creator,
        connectedAddress: knownCreatorAddress,
        creators: availableCreators,
      })
      setSelectedCreator(preferred)
    }
    catch (error) {
      console.error('Failed to load proposer whitelist', error)
      setStatus(previous => creator && previous?.creator.toLowerCase() === creator.toLowerCase() ? previous : null)
      toast.error(error instanceof Error ? error.message : t('Could not load proposer whitelist.'))
    }
    finally {
      setIsLoading(false)
    }
  }, [initialCreatorAddress, knownCreatorAddress, onStatusChange, signers, t])

  const bootstrapDialog = useEffectEvent(async () => {
    const nextSigners = await loadSigners()
    const preferred = getPreferredCreator({
      initialCreatorAddress,
      selectedCreator: null,
      connectedAddress: knownCreatorAddress,
      creators: mergeCreatorOptions({
        creators: [],
        signers: nextSigners,
        connectedAddress: knownCreatorAddress,
        connectedLabel: t('EOA wallet'),
      }),
    })
    await loadStatus(preferred, nextSigners)
  })

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(function loadOnOpen() {
    if (!open) {
      return
    }

    void bootstrapDialog()
  }, [open])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  async function runServerMutation(action: 'create' | 'add' | 'remove', proposers: Address[]) {
    if (!selectedCreator) {
      throw new Error(t('Select a creator wallet first.'))
    }

    const response = await fetch('/admin/api/proposer-whitelists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        creator: selectedCreator,
        proposers,
      }),
    })
    const payload = await response.json().catch(() => null) as unknown
    const apiError = readApiError(payload)
    if (!response.ok || apiError || !isMutationResponse(payload)) {
      throw new Error(apiError || t('Could not update proposer whitelist ({status})', { status: String(response.status) }))
    }
    setStatus(payload.status)
    onStatusChange?.(payload.status)
    return payload.txHashes
  }

  async function waitForWalletTx(hash: Hash) {
    const client = publicClient
    if (!client) {
      return
    }
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(t('Transaction failed: {hash}', { hash }))
    }
    return receipt
  }

  function getConnectedWalletClient() {
    if (!selectedCreator) {
      throw new Error(t('Select a creator wallet first.'))
    }
    if (!canUseConnectedWallet || !walletClient) {
      throw new Error(t('Use the selected creator EOA in your wallet to sign this action.'))
    }
    if (walletClient.chain?.id && walletClient.chain.id !== DEFAULT_CHAIN_ID) {
      throw new Error(t('Switch wallet to {chain} before updating proposer whitelist.', { chain: defaultViemNetwork.name }))
    }
    return walletClient
  }

  async function sendWalletTransaction(input: {
    title: string
    description: string
    account: Address
    data: Hex
    to?: Address
    value?: bigint
  }) {
    const client = getConnectedWalletClient()

    function send(overrides?: {
      maxFeePerGas?: bigint
      maxPriorityFeePerGas?: bigint
    }) {
      return client.sendTransaction({
        account: input.account,
        chain: client.chain,
        to: input.to,
        data: input.data,
        value: input.value ?? 0n,
        ...(overrides ?? {}),
      })
    }

    async function sendWithRpcFallback(overrides?: {
      maxFeePerGas?: bigint
      maxPriorityFeePerGas?: bigint
    }) {
      try {
        return await runWithSignaturePrompt(() => send(overrides), {
          title: input.title,
          description: input.description,
        })
      }
      catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError)
        if (!isBigIntSerializationError(message)) {
          throw sendError
        }

        const txRequest = buildRpcWalletTransactionRequest({
          from: input.account,
          to: input.to,
          data: input.data,
          value: input.value ?? 0n,
          ...(overrides ?? {}),
        })
        const rpcHash = await runWithSignaturePrompt(
          () => client.request({
            method: 'eth_sendTransaction',
            params: [txRequest],
          }) as Promise<unknown>,
          {
            title: input.title,
            description: input.description,
          },
        )
        if (typeof rpcHash !== 'string' || !rpcHash.startsWith('0x')) {
          throw new Error(t('Wallet provider returned an invalid transaction hash.'))
        }
        return rpcHash as Hash
      }
    }

    if (!publicClient) {
      return sendWithRpcFallback()
    }

    return sendWithEstimatedFeeRetry({
      chainId: client.chain?.id ?? DEFAULT_CHAIN_ID,
      client: publicClient,
      send: sendWithRpcFallback,
    })
  }

  async function runWalletCreate(proposers: Address[]) {
    if (!selectedCreator || !status) {
      throw new Error(t('Select a creator wallet first.'))
    }
    const deployHash = await sendWalletTransaction({
      title: t('Deploy proposer whitelist'),
      description: t('Transaction 1 of 2: deploy the whitelist contract for this creator.'),
      account: selectedCreator,
      data: encodeDeployData({
        abi: CREATOR_PROPOSER_WHITELIST_ABI,
        bytecode: CREATOR_PROPOSER_WHITELIST_BYTECODE,
        args: [selectedCreator, proposers],
      }),
    })
    const deployReceipt = await waitForWalletTx(deployHash)
    const whitelistAddress = deployReceipt?.contractAddress && isAddress(deployReceipt.contractAddress)
      ? getAddress(deployReceipt.contractAddress) as Address
      : null
    if (!whitelistAddress) {
      throw new Error(t('Whitelist deployment did not return a contract address.'))
    }

    const registerHash = await sendWalletTransaction({
      title: t('Register proposer whitelist'),
      description: t('Transaction 2 of 2: register this whitelist in the registry.'),
      account: selectedCreator,
      to: status.registryAddress,
      data: encodeFunctionData({
        abi: CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
        functionName: 'registerWhitelist',
        args: [whitelistAddress],
      }),
    })
    await waitForWalletTx(registerHash)
  }

  async function runWalletUpdate(action: 'add' | 'remove', proposers: Address[]) {
    if (!selectedCreator || !status?.whitelistAddress) {
      throw new Error(t('Creator whitelist is not registered yet.'))
    }
    const hash = await sendWalletTransaction({
      title: action === 'add' ? t('Add proposers') : t('Remove proposer'),
      description: t('Open your wallet and approve the whitelist update.'),
      account: selectedCreator,
      to: status.whitelistAddress,
      data: encodeFunctionData({
        abi: CREATOR_PROPOSER_WHITELIST_ABI,
        functionName: action === 'add' ? 'addProposers' : 'removeProposers',
        args: [proposers],
      }),
    })
    await waitForWalletTx(hash)
  }

  async function mutate(action: 'create' | 'add' | 'remove', rawProposers: string | string[]) {
    if (!selectedCreator) {
      toast.error(t('Select a creator wallet first.'))
      return
    }

    let proposers: Address[] = []
    try {
      proposers = normalizeProposerAddressList(rawProposers)
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('Invalid wallet address.'))
      return
    }

    if (proposers.length === 0 && action !== 'create') {
      toast.error(t('Add at least one wallet.'))
      return
    }

    setIsMutating(true)
    try {
      if (canUseServerSigner && !canUseConnectedWallet) {
        await runServerMutation(action, proposers)
      }
      else if (action === 'create') {
        await runWalletCreate(proposers)
      }
      else {
        await runWalletUpdate(action, proposers)
      }

      await loadStatus(selectedCreator)
      setWalletInput('')
      setAddOpen(false)
      toast.success(action === 'remove' ? t('Proposer removed.') : t('Proposer whitelist updated.'))
    }
    catch (error) {
      console.error('Failed to update proposer whitelist', error)
      toast.error(readDialogError(error))
    }
    finally {
      setIsMutating(false)
    }
  }

  function handleCreatorChange(value: string) {
    if (!isAddress(value)) {
      return
    }
    const nextCreator = getAddress(value) as Address
    setSelectedCreator(nextCreator)
    setAddOpen(false)
    setWalletInput('')
    void loadStatus(nextCreator)
  }

  const proposerRows = status?.proposers ?? []
  const connectedAddressAlreadyListed = Boolean(
    knownCreatorAddress && proposerRows.some(proposer => proposer.toLowerCase() === knownCreatorAddress.toLowerCase()),
  )
  const showAddYourWallet = Boolean((!status?.whitelistAddress || addOpen) && knownCreatorAddress && !connectedAddressAlreadyListed && !walletInput.trim())
  const actionDisabled = isLoading || isMutating || !selectedCreator || !status || (!canUseConnectedWallet && !canUseServerSigner)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheckIcon className="size-5" />
            {t('Proposers')}
          </DialogTitle>
          <DialogDescription>
            {t('Add trusted wallets that can propose market outcomes in UMA.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>{t('Creator wallet')}</Label>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CircleIcon
                  className={cn(
                    'size-3.5 fill-current stroke-none',
                    status?.whitelistAddress ? 'text-emerald-500' : 'text-muted-foreground/70',
                  )}
                />
                <span className="text-muted-foreground">
                  {status?.whitelistAddress ? t('Whitelist registered') : t('Whitelist not registered')}
                </span>
              </div>
            </div>
            <Select
              value={selectedCreator ?? undefined}
              onValueChange={handleCreatorChange}
              disabled={isLoading || isMutating || lockCreatorSelection}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoading ? t('Loading creators...') : t('Select creator')} />
              </SelectTrigger>
              <SelectContent>
                {creatorOptions.map(creator => (
                  <SelectItem key={creator.address} value={creator.address}>
                    {creator.displayName}
                    {' · '}
                    {creator.shortAddress}
                    {creator.hasServerSigner ? ` · ${t('server')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            {isSwitchingCreator && (
              <div
                className={cn(
                  'absolute inset-0 z-10 flex items-center justify-center',
                  'rounded-md bg-background/80 backdrop-blur-[1px]',
                )}
              >
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('Loading creators...')}
                </div>
              </div>
            )}

            <div className={cn('grid gap-4', isSwitchingCreator && 'pointer-events-none opacity-60')}>
              {status?.whitelistAddress && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{t('Allowed proposers')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => setAddOpen(previous => !previous)}
                      disabled={isMutating || actionDisabled}
                    >
                      <PlusIcon className="size-3.5" />
                      {t('Add')}
                    </Button>
                  </div>

                  <div className="grid max-h-[280px] gap-2 overflow-y-auto rounded-md border p-2 pr-1">
                    {proposerRows.map(proposer => (
                      <div
                        key={proposer}
                        className="flex items-center justify-between gap-2 rounded-sm bg-muted/25 px-2 py-1.5"
                      >
                        <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">{proposer}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 rounded-md"
                          aria-label={t('Remove proposer')}
                          disabled={isMutating || actionDisabled}
                          onClick={() => void mutate('remove', [proposer])}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!status?.whitelistAddress || addOpen) && (
                <div className="grid gap-2">
                  <Label>{status?.whitelistAddress ? t('Add proposer wallets') : t('Initial proposer wallets')}</Label>
                  <Textarea
                    value={walletInput}
                    onChange={event => setWalletInput(event.target.value)}
                    placeholder="0x123..., 0xabc..."
                    className="min-h-20"
                    disabled={isMutating}
                  />
                  {!status?.whitelistAddress && (
                    <p className="text-xs text-muted-foreground">
                      {t('The creator wallet is always included by the whitelist contract. Add only extra proposer wallets here.')}
                    </p>
                  )}
                  {!status?.whitelistAddress && canUseConnectedWallet && (
                    <p className="text-xs text-muted-foreground">
                      {t('Creating a new whitelist requires two onchain transactions: deploy the whitelist, then register it.')}
                    </p>
                  )}
                  {showAddYourWallet && (
                    <button
                      type="button"
                      className="w-fit text-xs font-medium text-primary hover:opacity-80"
                      onClick={() => setWalletInput(knownCreatorAddress ?? '')}
                    >
                      {t('add my own wallet')}
                    </button>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void mutate(status?.whitelistAddress ? 'add' : 'create', walletInput)}
                      disabled={actionDisabled}
                    >
                      {isMutating
                        ? <Loader2Icon className="size-4 animate-spin" />
                        : status?.whitelistAddress
                          ? <PlusIcon className="size-4" />
                          : <CheckCircle2Icon className="size-4" />}
                      {status?.whitelistAddress ? t('Add proposers') : t('Create whitelist')}
                    </Button>
                  </div>
                </div>
              )}

              {!canUseConnectedWallet && !canUseServerSigner && selectedCreator && (
                <p className="text-sm text-destructive">
                  {t('Use the selected creator EOA or configure its private key in environment variables to update the whitelist.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
