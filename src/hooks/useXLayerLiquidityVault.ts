'use client'

import type { Address, Hash, TransactionReceipt } from 'viem'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatUnits, getAddress, parseEventLogs } from 'viem'
import { xLayer } from 'viem/chains'
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import {
  getLiquidityVaultAddress,
  getLiquidityVaultEntries,
  liquidityErc20Abi,
  liquidityVaultAbi,
} from '@/lib/liquidity/onchain-vault'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'

export interface XLayerLiquidityPoolSummary {
  accountedAssets: bigint
  address: Address
  availableWithdrawalAssets: bigint
  claimableWithdrawalAssets: bigint
  currentEpoch: bigint
  lastFinalizedEpoch: bigint
  lastSharePrice: bigint
  pendingDepositAssets: bigint
  sharePrice: bigint
  slug: string
  strategyAllocatedAssets: bigint
  totalQueuedWithdrawalShares: bigint
  totalSupply: bigint
  withdrawableBalance: bigint
}

export interface XLayerLiquidityDepositRecord {
  assets: bigint
  claimable: boolean
  claimed: boolean
  epoch: bigint
  poolSlug: string
  requestedAt?: string
  txHash?: Hash
}

export interface XLayerLiquidityWithdrawalRecord {
  assetsClaimable: bigint
  completed: boolean
  epoch: bigint
  owner: Address
  poolSlug: string
  requestedAt?: string
  requestId: bigint
  sharesInitial?: bigint
  sharesRemaining: bigint
  txHash?: Hash
}

export interface XLayerLiquiditySelectedState extends XLayerLiquidityPoolSummary {
  allowance: bigint
  assetBalance: bigint
  claimableDeposits: XLayerLiquidityDepositRecord[]
  deposits: XLayerLiquidityDepositRecord[]
  lockedUntil: bigint
  userShares: bigint
  withdrawals: XLayerLiquidityWithdrawalRecord[]
}

interface StoredDepositRecord {
  assets: string
  epoch: string
  poolSlug: string
  requestedAt: string
  txHash?: Hash
  vaultAddress: Address
}

interface StoredWithdrawalRecord {
  poolSlug: string
  requestId: string
  requestedAt: string
  sharesInitial: string
  txHash?: Hash
  vaultAddress: Address
}

interface StoredRecords {
  deposits: StoredDepositRecord[]
  withdrawals: StoredWithdrawalRecord[]
}

interface UseXLayerLiquidityVaultParams {
  openWallet: () => Promise<void>
  selectedPoolSlug?: string | null
}

const EMPTY_RECORDS: StoredRecords = {
  deposits: [],
  withdrawals: [],
}

function findInjectedConnector(connectors: ReturnType<typeof useConnect>['connectors']) {
  return connectors.find(connector => connector.id === 'injected' || connector.type === 'injected') ?? connectors[0] ?? null
}

function sameAddress(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeAddress(left)
  const normalizedRight = normalizeAddress(right)
  return Boolean(normalizedLeft && normalizedRight && getAddress(normalizedLeft) === getAddress(normalizedRight))
}

function storageKey(account?: Address) {
  return account ? `astraodds:xlayer-liquidity:${xLayer.id}:${getAddress(account)}` : null
}

function loadStoredRecords(account?: Address): StoredRecords {
  const key = storageKey(account)
  if (!key || typeof window === 'undefined') {
    return EMPTY_RECORDS
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return EMPTY_RECORDS
    }

    const parsed = JSON.parse(raw) as Partial<StoredRecords>
    return {
      deposits: Array.isArray(parsed.deposits) ? parsed.deposits : [],
      withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
    }
  }
  catch {
    return EMPTY_RECORDS
  }
}

function saveStoredRecords(account: Address | undefined, records: StoredRecords) {
  const key = storageKey(account)
  if (!key || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(records))
}

function findDepositEpochFromReceipt(receipt: TransactionReceipt, vaultAddress: Address) {
  const events = parseEventLogs({
    abi: liquidityVaultAbi,
    eventName: 'DepositRequested',
    logs: [...receipt.logs],
  })

  const event = events.find(candidate => sameAddress(candidate.address, vaultAddress))
  return event?.args.epoch
}

function findWithdrawalRequestFromReceipt(receipt: TransactionReceipt, vaultAddress: Address) {
  const events = parseEventLogs({
    abi: liquidityVaultAbi,
    eventName: 'WithdrawalRequested',
    logs: [...receipt.logs],
  })

  const event = events.find(candidate => sameAddress(candidate.address, vaultAddress))
  return event
    ? {
        epoch: event.args.epoch,
        requestId: event.args.requestId,
      }
    : null
}

export function useXLayerLiquidityVault({
  openWallet,
  selectedPoolSlug,
}: UseXLayerLiquidityVaultParams) {
  const runtimeConfig = usePublicRuntimeConfig()
  const account = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId: xLayer.id })
  const { connectors, connectAsync } = useConnect()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const assetAddress = normalizeAddress(runtimeConfig.xlayerLiquidityAssetAddress)
  const assetDecimals = runtimeConfig.xlayerLiquidityAssetDecimals
  const assetSymbol = runtimeConfig.xlayerLiquidityAssetSymbol
  const selectedVaultAddress = getLiquidityVaultAddress(runtimeConfig, selectedPoolSlug)
  const vaultEntries = useMemo(() => getLiquidityVaultEntries(runtimeConfig), [runtimeConfig])
  const [records, setRecords] = useState<StoredRecords>(EMPTY_RECORDS)
  const [poolSummaries, setPoolSummaries] = useState<Record<string, XLayerLiquidityPoolSummary>>({})
  const [selectedState, setSelectedState] = useState<XLayerLiquiditySelectedState | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setRecords(loadStoredRecords(account.address as Address | undefined))
  }, [account.address])

  const updateStoredRecords = useCallback((updater: (current: StoredRecords) => StoredRecords) => {
    setRecords((current) => {
      const next = updater(current)
      saveStoredRecords(account.address as Address | undefined, next)
      return next
    })
  }, [account.address])

  const ensureWalletAddress = useCallback(async (): Promise<Address | null> => {
    if (account.address) {
      return account.address as Address
    }

    try {
      await openWallet()
    }
    catch {}

    const injectedConnector = findInjectedConnector(connectors)
    if (!injectedConnector) {
      toast.error('请先连接钱包。')
      return null
    }

    try {
      const result = await connectAsync({
        connector: injectedConnector,
        chainId: xLayer.id,
      })
      const firstAccount = result.accounts[0]
      return firstAccount ? firstAccount as Address : null
    }
    catch (error) {
      if (!isUserRejectedRequestError(error)) {
        toast.error('钱包连接失败。')
      }
      return null
    }
  }, [account.address, connectAsync, connectors, openWallet])

  const ensureXLayerNetwork = useCallback(async () => {
    if (chainId === xLayer.id) {
      return true
    }

    try {
      await switchChainAsync({ chainId: xLayer.id })
      return true
    }
    catch (error) {
      if (!isUserRejectedRequestError(error)) {
        toast.error('请把钱包切换到 X Layer。')
      }
      return false
    }
  }, [chainId, switchChainAsync])

  const readPoolSummary = useCallback(async (
    slug: string,
    vaultAddress: Address,
  ): Promise<XLayerLiquidityPoolSummary> => {
    if (!publicClient) {
      throw new Error('X Layer RPC is not ready.')
    }

    const [
      accountedAssets,
      availableWithdrawalAssets,
      claimableWithdrawalAssets,
      currentEpoch,
      lastFinalizedEpoch,
      lastSharePrice,
      pendingDepositAssets,
      sharePrice,
      strategyAllocatedAssets,
      totalQueuedWithdrawalShares,
      totalSupply,
      withdrawableBalance,
    ] = await Promise.all([
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'accountedAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'availableWithdrawalAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'claimableWithdrawalAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'currentEpoch' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'lastFinalizedEpoch' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'lastSharePrice' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'pendingDepositAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'sharePrice' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'strategyAllocatedAssets' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'totalQueuedWithdrawalShares' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'totalSupply' }),
      publicClient.readContract({ address: vaultAddress, abi: liquidityVaultAbi, functionName: 'withdrawableBalance' }),
    ])

    return {
      accountedAssets,
      address: vaultAddress,
      availableWithdrawalAssets,
      claimableWithdrawalAssets,
      currentEpoch,
      lastFinalizedEpoch,
      lastSharePrice,
      pendingDepositAssets,
      sharePrice,
      slug,
      strategyAllocatedAssets,
      totalQueuedWithdrawalShares,
      totalSupply,
      withdrawableBalance,
    }
  }, [publicClient])

  const refreshAll = useCallback(async () => {
    if (!publicClient || vaultEntries.length === 0) {
      return
    }

    setIsRefreshing(true)
    try {
      const summaries = await Promise.all(
        vaultEntries.map(entry => readPoolSummary(entry.slug, entry.address)),
      )
      setPoolSummaries(Object.fromEntries(summaries.map(summary => [summary.slug, summary])))
    }
    catch (error) {
      console.error('Failed to read X Layer liquidity vaults.', error)
    }
    finally {
      setIsRefreshing(false)
    }
  }, [publicClient, readPoolSummary, vaultEntries])

  const refreshSelected = useCallback(async () => {
    if (!publicClient || !selectedVaultAddress || !assetAddress) {
      setSelectedState(null)
      return
    }

    const normalizedSelectedSlug = vaultEntries.find(entry => sameAddress(entry.address, selectedVaultAddress))?.slug
      ?? selectedPoolSlug
      ?? 'unknown'

    setIsRefreshing(true)
    try {
      const summary = await readPoolSummary(normalizedSelectedSlug, selectedVaultAddress)
      const walletAddress = account.address as Address | undefined

      let allowance = 0n
      let assetBalance = 0n
      let lockedUntil = 0n
      let userShares = 0n
      let deposits: XLayerLiquidityDepositRecord[] = []
      let withdrawals: XLayerLiquidityWithdrawalRecord[] = []

      if (walletAddress) {
        const [
          nextAllowance,
          nextAssetBalance,
          nextLockedUntil,
          nextUserShares,
        ] = await Promise.all([
          publicClient.readContract({
            address: assetAddress,
            abi: liquidityErc20Abi,
            functionName: 'allowance',
            args: [walletAddress, selectedVaultAddress],
          }),
          publicClient.readContract({
            address: assetAddress,
            abi: liquidityErc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress],
          }),
          publicClient.readContract({
            address: selectedVaultAddress,
            abi: liquidityVaultAbi,
            functionName: 'lockedUntil',
            args: [walletAddress],
          }),
          publicClient.readContract({
            address: selectedVaultAddress,
            abi: liquidityVaultAbi,
            functionName: 'balanceOf',
            args: [walletAddress],
          }),
        ])

        allowance = nextAllowance
        assetBalance = nextAssetBalance
        lockedUntil = nextLockedUntil
        userShares = nextUserShares

        const epochCandidates = new Set<bigint>([
          summary.currentEpoch,
          summary.currentEpoch > 0n ? summary.currentEpoch - 1n : summary.currentEpoch,
          ...records.deposits
            .filter(record => sameAddress(record.vaultAddress, selectedVaultAddress))
            .map(record => BigInt(record.epoch)),
        ])

        deposits = (await Promise.all([...epochCandidates].map(async (epoch): Promise<XLayerLiquidityDepositRecord | null> => {
          const [assets, claimed] = await publicClient.readContract({
            address: selectedVaultAddress,
            abi: liquidityVaultAbi,
            functionName: 'pendingDepositOf',
            args: [walletAddress, epoch],
          })
          const stored = records.deposits.find(record => (
            sameAddress(record.vaultAddress, selectedVaultAddress) && BigInt(record.epoch) === epoch
          ))

          return assets > 0n || stored
            ? {
                assets,
                claimable: assets > 0n && !claimed && epoch < summary.lastFinalizedEpoch,
                claimed,
                epoch,
                poolSlug: normalizedSelectedSlug,
                requestedAt: stored?.requestedAt,
                txHash: stored?.txHash,
              }
            : null
        }))).filter((record): record is XLayerLiquidityDepositRecord => record !== null)

        withdrawals = (await Promise.all(records.withdrawals
          .filter(record => sameAddress(record.vaultAddress, selectedVaultAddress))
          .map(async (record): Promise<XLayerLiquidityWithdrawalRecord | null> => {
            const [owner, epoch, sharesRemaining, assetsClaimable, completed] = await publicClient.readContract({
              address: selectedVaultAddress,
              abi: liquidityVaultAbi,
              functionName: 'withdrawalRequests',
              args: [BigInt(record.requestId)],
            })

            return sameAddress(owner, walletAddress)
              ? {
                  assetsClaimable,
                  completed,
                  epoch,
                  owner,
                  poolSlug: normalizedSelectedSlug,
                  requestedAt: record.requestedAt,
                  requestId: BigInt(record.requestId),
                  sharesInitial: BigInt(record.sharesInitial),
                  sharesRemaining,
                  txHash: record.txHash,
                }
              : null
          }))).filter((record): record is XLayerLiquidityWithdrawalRecord => record !== null)
      }

      const nextState: XLayerLiquiditySelectedState = {
        ...summary,
        allowance,
        assetBalance,
        claimableDeposits: deposits.filter(deposit => deposit.claimable),
        deposits,
        lockedUntil,
        userShares,
        withdrawals,
      }

      setPoolSummaries(current => ({
        ...current,
        [summary.slug]: summary,
      }))
      setSelectedState(nextState)
    }
    catch (error) {
      console.error('Failed to read selected X Layer liquidity vault.', error)
      setSelectedState(null)
    }
    finally {
      setIsRefreshing(false)
    }
  }, [
    account.address,
    assetAddress,
    publicClient,
    readPoolSummary,
    records.deposits,
    records.withdrawals,
    selectedPoolSlug,
    selectedVaultAddress,
    vaultEntries,
  ])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    void refreshSelected()
  }, [refreshSelected])

  const ensureAssetApproval = useCallback(async ({
    amount,
    vaultAddress,
    walletAddress,
  }: {
    amount: bigint
    vaultAddress: Address
    walletAddress: Address
  }) => {
    if (!publicClient || !assetAddress) {
      throw new Error('X Layer asset is not configured.')
    }

    const allowance = await publicClient.readContract({
      address: assetAddress,
      abi: liquidityErc20Abi,
      functionName: 'allowance',
      args: [walletAddress, vaultAddress],
    })

    if (allowance >= amount) {
      return
    }

    if (allowance > 0n) {
      toast.message(`重置 ${assetSymbol} 授权...`)
      const resetHash = await writeContractAsync({
        chainId: xLayer.id,
        address: assetAddress,
        abi: liquidityErc20Abi,
        functionName: 'approve',
        args: [vaultAddress, 0n],
      })
      const resetReceipt = await publicClient.waitForTransactionReceipt({ hash: resetHash })
      if (resetReceipt.status !== 'success') {
        throw new Error('授权重置失败。')
      }
    }

    toast.message(`授权 ${assetSymbol}...`)
    const approveHash = await writeContractAsync({
      chainId: xLayer.id,
      address: assetAddress,
      abi: liquidityErc20Abi,
      functionName: 'approve',
      args: [vaultAddress, amount],
    })
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })
    if (approveReceipt.status !== 'success') {
      throw new Error('授权失败。')
    }
  }, [assetAddress, assetSymbol, publicClient, writeContractAsync])

  const requestDeposit = useCallback(async (assets: bigint) => {
    if (!publicClient || !assetAddress || !selectedVaultAddress) {
      toast.error('链上流动性池还没有配置好。')
      return false
    }
    if (assets <= 0n) {
      toast.error('请输入存入金额。')
      return false
    }
    if (isSubmitting) {
      return false
    }

    const walletAddress = await ensureWalletAddress()
    if (!walletAddress || !await ensureXLayerNetwork()) {
      return false
    }

    setIsSubmitting(true)
    try {
      const balance = await publicClient.readContract({
        address: assetAddress,
        abi: liquidityErc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      })
      if (balance < assets) {
        toast.error(`${assetSymbol} 余额不足。`)
        return false
      }

      await ensureAssetApproval({
        amount: assets,
        vaultAddress: selectedVaultAddress,
        walletAddress,
      })

      await publicClient.simulateContract({
        account: walletAddress,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'requestDeposit',
        args: [assets],
      })

      toast.message('提交存入请求...')
      const hash = await writeContractAsync({
        chainId: xLayer.id,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'requestDeposit',
        args: [assets],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('存入交易失败。')
      }

      const epoch = findDepositEpochFromReceipt(receipt, selectedVaultAddress)
        ?? await publicClient.readContract({
          address: selectedVaultAddress,
          abi: liquidityVaultAbi,
          functionName: 'currentEpoch',
        })
      const poolSlug = selectedPoolSlug ?? selectedState?.slug ?? 'unknown'

      updateStoredRecords(current => ({
        deposits: [
          ...current.deposits.filter(record => !(
            sameAddress(record.vaultAddress, selectedVaultAddress) && BigInt(record.epoch) === epoch
          )),
          {
            assets: assets.toString(),
            epoch: epoch.toString(),
            poolSlug,
            requestedAt: new Date().toISOString(),
            txHash: hash,
            vaultAddress: selectedVaultAddress,
          },
        ],
        withdrawals: current.withdrawals,
      }))

      toast.success('存入请求已上链', {
        description: `下一次 daily NAV finalized 后可领取 LP。`,
      })
      await refreshSelected()
      await refreshAll()
      return true
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        toast.info('已取消。')
        return false
      }

      console.error('X Layer liquidity deposit failed.', error)
      toast.error('存入失败，请检查余额、授权和网络。')
      return false
    }
    finally {
      setIsSubmitting(false)
    }
  }, [
    assetAddress,
    assetSymbol,
    ensureAssetApproval,
    ensureWalletAddress,
    ensureXLayerNetwork,
    isSubmitting,
    publicClient,
    refreshAll,
    refreshSelected,
    selectedPoolSlug,
    selectedState?.slug,
    selectedVaultAddress,
    updateStoredRecords,
    writeContractAsync,
  ])

  const claimDeposit = useCallback(async (epoch: bigint) => {
    if (!publicClient || !selectedVaultAddress) {
      toast.error('链上流动性池还没有配置好。')
      return false
    }
    if (isSubmitting) {
      return false
    }

    const walletAddress = await ensureWalletAddress()
    if (!walletAddress || !await ensureXLayerNetwork()) {
      return false
    }

    setIsSubmitting(true)
    try {
      await publicClient.simulateContract({
        account: walletAddress,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'claimDeposit',
        args: [epoch],
      })
      const hash = await writeContractAsync({
        chainId: xLayer.id,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'claimDeposit',
        args: [epoch],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('领取 LP 交易失败。')
      }

      updateStoredRecords(current => ({
        deposits: current.deposits.filter(record => !(
          sameAddress(record.vaultAddress, selectedVaultAddress) && BigInt(record.epoch) === epoch
        )),
        withdrawals: current.withdrawals,
      }))
      toast.success('LP 已领取')
      await refreshSelected()
      await refreshAll()
      return true
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        toast.info('已取消。')
        return false
      }

      console.error('X Layer liquidity claim deposit failed.', error)
      toast.error('领取 LP 失败，可能还没到 finalized NAV。')
      return false
    }
    finally {
      setIsSubmitting(false)
    }
  }, [
    ensureWalletAddress,
    ensureXLayerNetwork,
    isSubmitting,
    publicClient,
    refreshAll,
    refreshSelected,
    selectedVaultAddress,
    updateStoredRecords,
    writeContractAsync,
  ])

  const requestWithdraw = useCallback(async (shares: bigint) => {
    if (!publicClient || !selectedVaultAddress) {
      toast.error('链上流动性池还没有配置好。')
      return false
    }
    if (shares <= 0n) {
      toast.error('请输入退出份额。')
      return false
    }
    if (isSubmitting) {
      return false
    }

    const walletAddress = await ensureWalletAddress()
    if (!walletAddress || !await ensureXLayerNetwork()) {
      return false
    }

    setIsSubmitting(true)
    try {
      const [balance, lockedUntil] = await Promise.all([
        publicClient.readContract({
          address: selectedVaultAddress,
          abi: liquidityVaultAbi,
          functionName: 'balanceOf',
          args: [walletAddress],
        }),
        publicClient.readContract({
          address: selectedVaultAddress,
          abi: liquidityVaultAbi,
          functionName: 'lockedUntil',
          args: [walletAddress],
        }),
      ])

      if (balance < shares) {
        toast.error('LP 份额不足。')
        return false
      }
      if (lockedUntil > BigInt(Math.floor(Date.now() / 1000))) {
        toast.error('LP 还在 7 天锁定期内。')
        return false
      }

      await publicClient.simulateContract({
        account: walletAddress,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'requestWithdraw',
        args: [shares],
      })

      toast.message('提交退出请求...')
      const hash = await writeContractAsync({
        chainId: xLayer.id,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'requestWithdraw',
        args: [shares],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('退出交易失败。')
      }

      const event = findWithdrawalRequestFromReceipt(receipt, selectedVaultAddress)
      if (!event) {
        throw new Error('退出交易成功但没有找到 requestId。')
      }
      const poolSlug = selectedPoolSlug ?? selectedState?.slug ?? 'unknown'

      updateStoredRecords(current => ({
        deposits: current.deposits,
        withdrawals: [
          ...current.withdrawals.filter(record => !(
            sameAddress(record.vaultAddress, selectedVaultAddress) && BigInt(record.requestId) === event.requestId
          )),
          {
            poolSlug,
            requestId: event.requestId.toString(),
            requestedAt: new Date().toISOString(),
            sharesInitial: shares.toString(),
            txHash: hash,
            vaultAddress: selectedVaultAddress,
          },
        ],
      }))

      toast.success('退出请求已上链', {
        description: '下一次 daily NAV finalized 后按队列结算。',
      })
      await refreshSelected()
      await refreshAll()
      return true
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        toast.info('已取消。')
        return false
      }

      console.error('X Layer liquidity withdraw failed.', error)
      toast.error('退出失败，请检查锁定期和 LP 份额。')
      return false
    }
    finally {
      setIsSubmitting(false)
    }
  }, [
    ensureWalletAddress,
    ensureXLayerNetwork,
    isSubmitting,
    publicClient,
    refreshAll,
    refreshSelected,
    selectedPoolSlug,
    selectedState?.slug,
    selectedVaultAddress,
    updateStoredRecords,
    writeContractAsync,
  ])

  const claimWithdraw = useCallback(async (requestId: bigint) => {
    if (!publicClient || !selectedVaultAddress) {
      toast.error('链上流动性池还没有配置好。')
      return false
    }
    if (isSubmitting) {
      return false
    }

    const walletAddress = await ensureWalletAddress()
    if (!walletAddress || !await ensureXLayerNetwork()) {
      return false
    }

    setIsSubmitting(true)
    try {
      await publicClient.simulateContract({
        account: walletAddress,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'claimWithdraw',
        args: [requestId],
      })
      const hash = await writeContractAsync({
        chainId: xLayer.id,
        address: selectedVaultAddress,
        abi: liquidityVaultAbi,
        functionName: 'claimWithdraw',
        args: [requestId],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('领取退出资金交易失败。')
      }

      await refreshSelected()
      await refreshAll()
      toast.success('退出资金已领取')
      return true
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        toast.info('已取消。')
        return false
      }

      console.error('X Layer liquidity claim withdraw failed.', error)
      toast.error('领取失败，可能还没有可领取金额。')
      return false
    }
    finally {
      setIsSubmitting(false)
    }
  }, [
    ensureWalletAddress,
    ensureXLayerNetwork,
    isSubmitting,
    publicClient,
    refreshAll,
    refreshSelected,
    selectedVaultAddress,
    writeContractAsync,
  ])

  return {
    accountAddress: account.address as Address | undefined,
    assetAddress,
    assetDecimals,
    assetSymbol,
    claimDeposit,
    claimWithdraw,
    epochSeconds: runtimeConfig.xlayerLiquidityEpochSeconds,
    isConfigured: Boolean(assetAddress && selectedVaultAddress),
    isRefreshing,
    isSubmitting,
    lockSeconds: runtimeConfig.xlayerLiquidityLockSeconds,
    poolSummaries,
    refreshAll,
    refreshSelected,
    requestDeposit,
    requestWithdraw,
    selectedState,
    selectedVaultAddress,
    walletAssetBalanceLabel: selectedState ? formatUnits(selectedState.assetBalance, assetDecimals) : '0',
  }
}
