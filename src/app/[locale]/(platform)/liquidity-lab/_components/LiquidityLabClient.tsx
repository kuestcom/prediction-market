'use client'

/* eslint-disable better-tailwindcss/no-unknown-classes */
import type { Route } from 'next'
import type {
  XLayerLiquidityPoolSummary,
  XLayerLiquiditySelectedState,
} from '@/hooks/useXLayerLiquidityVault'
import type {
  PoolNavState,
  SerializedLiquidityLabPool,
  SerializedLiquidityWithdrawalRequest,
} from '@/lib/liquidity'
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  BotIcon,
  CoinsIcon,
  GaugeIcon,
  ListChecksIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  accrueLiquidityRewardLabAction,
  allocateLiquidityBotCapitalLabAction,
  claimLiquidityWithdrawalLabAction,
  depositLiquidityLabAction,
  listLiquidityLabPoolsAction,
  seedLiquidityLabPoolsAction,
  settleLiquidityBotPnlLabAction,
  withdrawLiquidityLabAction,
} from '@/app/[locale]/(platform)/liquidity-lab/_actions/liquidity-lab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppKit } from '@/hooks/useAppKit'
import { useXLayerLiquidityVault } from '@/hooks/useXLayerLiquidityVault'
import {
  applyPoolNavDelta,
  buildAsyncWithdrawalRequest,
  calculateAsyncWithdrawCapacity,
  calculateImmediateWithdrawalCapacity,
  calculatePoolState,
  calculateStrategyAllocationCapitalDelta,
  getNextDailyNavFinalizationTime,
  previewDeposit,
} from '@/lib/liquidity'
import { normalizeLiquidityVaultSlug } from '@/lib/liquidity/deployment'
import { cn } from '@/lib/utils'

interface LabPool {
  activeStrategyAllocations: Array<{
    allocatedAmountMicro: bigint
    currentExposureAmountMicro: bigint
    marketConditionId: string
    marketSlug: string | null
    usedAmountMicro: bigint
  }>
  allocatedAmountMicro: bigint
  badDebtAmountMicro: bigint
  categorySlug: string
  feeAmountMicro: bigint
  id: string
  idleAmountMicro: bigint
  idleBufferBps: number
  lastFinalizedAt: string
  name: string
  navAmountMicro: bigint
  navStale: boolean
  openOrderAmountMicro: bigint
  pendingDeposits: LabPendingDeposit[]
  positionMarkAmountMicro: bigint
  realizedPnlAmountMicro: bigint
  rewardsAccruedAmountMicro: bigint
  riskBlocked: boolean
  riskTier: string
  singleMarketCapBps: number
  singleOutcomeCapBps: number
  slug: string
  status: string
  totalSharesMicro: bigint
  unrealizedPnlAmountMicro: bigint
  userPrincipalAmountMicro: bigint
  userShareLots: LabShareLot[]
  userSharesMicro: bigint
  utilizationCapBps: number
  withdrawalLiabilityAmountMicro: bigint
}

interface LabPendingDeposit {
  accountId: string
  amountMicro: bigint
  id: string
  requestedAt: string
}

interface LabShareLot {
  accountId: string
  lockedUntil: string
  mintedAt: string
  principalAmountMicro: bigint
  sharesMicro: bigint
  sourceDepositId: string
}

interface LabWithdrawalRequest extends SerializedLiquidityWithdrawalRequest {
  chainRequestId?: string
  claimableAssetsMicro?: string
  epochId?: string
  remainingSharesMicro?: string
}

interface LiquidityLabClientProps {
  basePath?: string
  initialPools: SerializedLiquidityLabPool[]
  initialPoolSlug?: string
  surface?: LiquidityLabSurface
}

interface LastAction {
  label: string
  tone: 'good' | 'neutral' | 'risk'
}

type LabMode = 'chain' | 'live' | 'sample'
type LiquidityLabSurface = 'full' | 'pools' | 'swap'
type OperationMode = 'add' | 'manage' | 'remove'
type PendingAction = 'allocation' | 'claim' | 'deposit' | 'finalize' | 'load' | 'reward' | 'seed' | 'settle' | 'withdraw'
type LabIcon = typeof WalletIcon

interface LiquidityLabActionResult {
  error: string | null
  message?: string
  pools: SerializedLiquidityLabPool[]
  withdrawalRequests?: SerializedLiquidityWithdrawalRequest[]
}

const MICRO = 1_000_000n
const PLATFORM_NAME = 'AstraOdds'
const SWAP_SLIPPAGE_BPS = 50
const SAMPLE_ACCOUNT_ID = 'sample-user'
const DAY_MS = 86_400_000

function categoryLabel(slug: string) {
  const labels: Record<string, string> = {
    crypto: '加密货币',
    culture: '文化',
    economy: '经济',
    elections: '选举',
    esports: '电竞',
    finance: '金融',
    geopolitics: '地缘政治',
    mentions: '提及',
    politics: '政治',
    sports: '体育',
    tech: '科技',
    technology: '科技',
    weather: '天气',
    world: '世界',
  }

  return labels[slug] ?? slug
}

function riskTierLabel(riskTier: string) {
  const labels: Record<string, string> = {
    aggressive: '进取',
    conservative: '稳健',
    standard: '标准',
  }

  return labels[riskTier] ?? riskTier
}

const CATEGORY_APR_BPS: Record<string, number> = {
  crypto: 1180,
  culture: 940,
  economy: 870,
  elections: 1510,
  esports: 1320,
  finance: 990,
  geopolitics: 1560,
  mentions: 760,
  politics: 1480,
  sports: 1420,
  tech: 1050,
  weather: 1210,
  world: 1120,
}

function estimatedAprBpsForPool(pool: Pick<LabPool, 'categorySlug' | 'riskTier'>) {
  return CATEGORY_APR_BPS[pool.categorySlug]
    ?? (pool.riskTier === 'conservative' ? 890 : pool.riskTier === 'aggressive' ? 1450 : 1100)
}

function poolDisplayName(pool: Pick<LabPool, 'categorySlug' | 'name'>) {
  if (pool.name.toLowerCase().includes('liquidity pool')) {
    return `${categoryLabel(pool.categorySlug)}板块流动性池`
  }

  return pool.name
}

function parseMicroInput(value: string) {
  const normalized = value.trim()
  if (!/^-?\d*(?:\.\d{0,6})?$/.test(normalized) || normalized === '' || normalized === '-' || normalized === '.') {
    throw new Error('Invalid amount.')
  }

  const negative = normalized.startsWith('-')
  const unsigned = negative ? normalized.slice(1) : normalized
  const [whole = '0', fraction = ''] = unsigned.split('.')
  const micro = (BigInt(whole || '0') * MICRO) + BigInt(fraction.padEnd(6, '0'))
  return negative ? -micro : micro
}

function parseNonNegativeMicroInput(value: string) {
  const amountMicro = parseMicroInput(value)
  if (amountMicro < 0n) {
    throw new Error('Amount must be non-negative.')
  }

  return amountMicro
}

function formatMicro(value: bigint, options: { signed?: boolean } = {}) {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / MICRO
  const fraction = absolute % MICRO
  const formatted = Number(`${whole}.${fraction.toString().padStart(6, '0')}`).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
  const sign = negative ? '-' : options.signed && value > 0n ? '+' : ''
  return `${sign}$${formatted}`
}

function formatMicroUnits(value: bigint, options: { signed?: boolean } = {}) {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / MICRO
  const fraction = absolute % MICRO
  const formatted = Number(`${whole}.${fraction.toString().padStart(6, '0')}`).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
  const sign = negative ? '-' : options.signed && value > 0n ? '+' : ''
  return `${sign}${formatted}`
}

function formatSharePrice(value: bigint) {
  return `$${(Number(value) / Number(MICRO)).toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  })}`
}

function formatBps(value: bigint | number) {
  const numeric = typeof value === 'bigint' ? Number(value) : value
  return `${(numeric / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`
}

function formatRate(value: number) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  })
}

function formatShortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '连接钱包'
}

function formatDuration(seconds: number) {
  if (seconds % 86_400 === 0) {
    return `${seconds / 86_400} 天`
  }
  if (seconds % 3_600 === 0) {
    return `${seconds / 3_600} 小时`
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60} 分钟`
  }
  return `${seconds} 秒`
}

function calculateBpsFromAmount(value: bigint, total: bigint) {
  if (total <= 0n || value <= 0n) {
    return 0n
  }

  return (value * 10_000n) / total
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function formatShortDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(typeof value === 'string' ? new Date(value) : value)
}

function createUnlockedShareLot({
  principalAmountMicro,
  sharesMicro,
}: {
  principalAmountMicro: bigint
  sharesMicro: bigint
}): LabShareLot {
  const mintedAt = new Date(Date.now() - 8 * DAY_MS)
  const lockedUntil = new Date(Date.now() - DAY_MS)

  return {
    accountId: SAMPLE_ACCOUNT_ID,
    lockedUntil: lockedUntil.toISOString(),
    mintedAt: mintedAt.toISOString(),
    principalAmountMicro,
    sharesMicro,
    sourceDepositId: 'opening-balance',
  }
}

function calculateAssetsAtSharePrice({
  sharePriceMicro,
  sharesMicro,
}: {
  sharePriceMicro: bigint
  sharesMicro: bigint
}) {
  if (sharesMicro <= 0n) {
    return 0n
  }

  return (sharesMicro * sharePriceMicro) / MICRO
}

function getPendingDepositAmount(pool: LabPool) {
  return pool.pendingDeposits.reduce((sum, deposit) => sum + deposit.amountMicro, 0n)
}

function getLockedShares(pool: LabPool, now: Date) {
  const lockedShares = pool.userShareLots.reduce((sum, lot) => (
    new Date(lot.lockedUntil) > now ? sum + lot.sharesMicro : sum
  ), 0n)

  return lockedShares > pool.userSharesMicro ? pool.userSharesMicro : lockedShares
}

function getRemainingWithdrawalShares(requests: LabWithdrawalRequest[], poolId: string) {
  return requests.reduce((sum, request) => {
    if (request.poolId !== poolId || request.status === 'completed' || request.status === 'cancelled') {
      return sum
    }

    return sum + BigInt(request.remainingSharesMicro ?? request.sharesToBurnMicro)
  }, 0n)
}

function getClaimableWithdrawalAssets(requests: LabWithdrawalRequest[], poolId: string) {
  return requests.reduce((sum, request) => {
    if (request.poolId !== poolId || request.status === 'completed' || request.status === 'cancelled') {
      return sum
    }

    return sum + BigInt(request.claimableAssetsMicro ?? request.immediateAmountMicro)
  }, 0n)
}

function getUnlockedShares(pool: LabPool, requests: LabWithdrawalRequest[], now: Date) {
  const lockedSharesMicro = getLockedShares(pool, now)
  const queuedSharesMicro = getRemainingWithdrawalShares(requests, pool.id)
  const unavailableSharesMicro = lockedSharesMicro + queuedSharesMicro

  return pool.userSharesMicro > unavailableSharesMicro ? pool.userSharesMicro - unavailableSharesMicro : 0n
}

function statusTone(status: string): 'default' | 'outline' | 'secondary' {
  if (status === 'completed') {
    return 'default'
  }
  if (status === 'claimable' || status === 'partial_claimable') {
    return 'secondary'
  }
  return 'outline'
}

function withdrawalStatusLabel(status: string) {
  if (status === 'completed') {
    return '已完成'
  }
  if (status === 'claimable') {
    return '可领取'
  }
  if (status === 'partial_claimable') {
    return '部分可领取'
  }
  if (status === 'queued') {
    return '排队中'
  }
  if (status === 'cancelled') {
    return '已取消'
  }
  return status
}

function toBigInt(value: string) {
  return BigInt(value)
}

function fromSerialized(pool: SerializedLiquidityLabPool): LabPool {
  const userSharesMicro = toBigInt(pool.userSharesMicro)
  const userPrincipalAmountMicro = toBigInt(pool.userPrincipalAmountMicro)

  return {
    ...pool,
    activeStrategyAllocations: pool.activeStrategyAllocations.map(allocation => ({
      allocatedAmountMicro: toBigInt(allocation.allocatedAmountMicro),
      currentExposureAmountMicro: toBigInt(allocation.currentExposureAmountMicro),
      marketConditionId: allocation.marketConditionId,
      marketSlug: allocation.marketSlug,
      usedAmountMicro: toBigInt(allocation.usedAmountMicro),
    })),
    allocatedAmountMicro: toBigInt(pool.allocatedAmountMicro),
    badDebtAmountMicro: toBigInt(pool.badDebtAmountMicro),
    feeAmountMicro: toBigInt(pool.feeAmountMicro),
    idleAmountMicro: toBigInt(pool.idleAmountMicro),
    lastFinalizedAt: new Date().toISOString(),
    navAmountMicro: toBigInt(pool.navAmountMicro),
    navStale: false,
    openOrderAmountMicro: toBigInt(pool.openOrderAmountMicro),
    pendingDeposits: [],
    positionMarkAmountMicro: toBigInt(pool.positionMarkAmountMicro),
    realizedPnlAmountMicro: toBigInt(pool.realizedPnlAmountMicro),
    rewardsAccruedAmountMicro: toBigInt(pool.rewardsAccruedAmountMicro),
    riskBlocked: false,
    totalSharesMicro: toBigInt(pool.totalSharesMicro),
    unrealizedPnlAmountMicro: toBigInt(pool.unrealizedPnlAmountMicro),
    userPrincipalAmountMicro,
    userShareLots: userSharesMicro > 0n
      ? [createUnlockedShareLot({ principalAmountMicro: userPrincipalAmountMicro, sharesMicro: userSharesMicro })]
      : [],
    userSharesMicro,
    withdrawalLiabilityAmountMicro: toBigInt(pool.withdrawalLiabilityAmountMicro),
  }
}

function getPoolVaultSlug(pool: Pick<LabPool, 'categorySlug' | 'slug'>) {
  return normalizeLiquidityVaultSlug(pool.categorySlug)
    ?? normalizeLiquidityVaultSlug(pool.slug)
}

function applyOnchainSummaryToPool({
  epochSeconds,
  pool,
  selectedState,
  summary,
}: {
  epochSeconds: number
  pool: LabPool
  selectedState?: XLayerLiquiditySelectedState | null
  summary: XLayerLiquidityPoolSummary
}): LabPool {
  const userSharesMicro = selectedState?.userShares ?? 0n
  const userPrincipalAmountMicro = selectedState
    ? calculateAssetsAtSharePrice({
        sharePriceMicro: selectedState.sharePrice,
        sharesMicro: userSharesMicro,
      })
    : 0n
  const lockedUntilMs = selectedState?.lockedUntil ? Number(selectedState.lockedUntil) * 1000 : 0
  const lockedUntil = lockedUntilMs > Date.now() ? new Date(lockedUntilMs) : new Date(Date.now() - DAY_MS)
  const queuedWithdrawalAssetsMicro = calculateAssetsAtSharePrice({
    sharePriceMicro: summary.sharePrice,
    sharesMicro: summary.totalQueuedWithdrawalShares,
  })
  const finalizedAtSeconds = Number(summary.lastFinalizedEpoch) * epochSeconds
  const finalizedAt = Number.isFinite(finalizedAtSeconds) && finalizedAtSeconds > 0
    ? new Date(finalizedAtSeconds * 1000)
    : new Date()

  return {
    ...pool,
    activeStrategyAllocations: summary.strategyAllocatedAssets > 0n
      ? [
          {
            allocatedAmountMicro: summary.strategyAllocatedAssets,
            currentExposureAmountMicro: summary.strategyAllocatedAssets,
            marketConditionId: `${summary.slug}-strategy-budget`,
            marketSlug: `${summary.slug}-strategy-budget`,
            usedAmountMicro: summary.strategyAllocatedAssets,
          },
        ]
      : [],
    allocatedAmountMicro: summary.strategyAllocatedAssets,
    idleAmountMicro: summary.withdrawableBalance,
    lastFinalizedAt: finalizedAt.toISOString(),
    navAmountMicro: summary.accountedAssets,
    pendingDeposits: summary.pendingDepositAssets > 0n
      ? [
          {
            accountId: 'onchain-pending',
            amountMicro: summary.pendingDepositAssets,
            id: `onchain-pending-${summary.slug}`,
            requestedAt: new Date().toISOString(),
          },
        ]
      : [],
    positionMarkAmountMicro: summary.strategyAllocatedAssets,
    status: 'chain',
    totalSharesMicro: summary.totalSupply,
    userPrincipalAmountMicro,
    userShareLots: userSharesMicro > 0n
      ? [
          {
            accountId: 'wallet',
            lockedUntil: lockedUntil.toISOString(),
            mintedAt: new Date(Date.now() - DAY_MS).toISOString(),
            principalAmountMicro: userPrincipalAmountMicro,
            sharesMicro: userSharesMicro,
            sourceDepositId: 'onchain-balance',
          },
        ]
      : [],
    userSharesMicro,
    withdrawalLiabilityAmountMicro: summary.claimableWithdrawalAssets + queuedWithdrawalAssetsMicro,
  }
}

function toOnchainWithdrawalRequests({
  poolId,
  selectedState,
}: {
  poolId: string
  selectedState: XLayerLiquiditySelectedState
}): LabWithdrawalRequest[] {
  return selectedState.withdrawals.map((request) => {
    const queuedAmountMicro = calculateAssetsAtSharePrice({
      sharePriceMicro: selectedState.sharePrice,
      sharesMicro: request.sharesRemaining,
    })
    const status = request.completed
      ? 'completed'
      : request.assetsClaimable > 0n
        ? request.sharesRemaining > 0n ? 'partial_claimable' : 'claimable'
        : 'queued'
    const requestedAt = request.requestedAt ?? new Date().toISOString()

    return {
      assetsAmountMicro: (request.assetsClaimable + queuedAmountMicro).toString(),
      chainRequestId: request.requestId.toString(),
      claimableAssetsMicro: request.assetsClaimable.toString(),
      claimableAt: request.assetsClaimable > 0n ? new Date().toISOString() : requestedAt,
      completedAt: request.completed ? new Date().toISOString() : null,
      createdAt: requestedAt,
      epochId: request.epoch.toString(),
      id: `chain-${selectedState.address}-${request.requestId.toString()}`,
      immediateAmountMicro: request.assetsClaimable.toString(),
      poolId,
      queuedAmountMicro: queuedAmountMicro.toString(),
      remainingSharesMicro: request.sharesRemaining.toString(),
      requestedAmountMicro: null,
      requestedAt,
      sharePriceMicro: selectedState.sharePrice.toString(),
      sharesToBurnMicro: (request.sharesInitial ?? request.sharesRemaining).toString(),
      status,
    }
  })
}

function labModeLabel(mode: LabMode) {
  if (mode === 'chain') {
    return '链上'
  }
  if (mode === 'live') {
    return '实盘'
  }
  return '演示'
}

const SAMPLE_POOL_CONFIGS = [
  { allocated: 210, idleBufferBps: 3_000, nav: 640, pnl: 8, rewards: 18, riskTier: 'standard', slug: 'sports', utilizationCapBps: 3_000 },
  { allocated: 185, idleBufferBps: 3_500, nav: 580, pnl: 12, rewards: 15, riskTier: 'conservative', slug: 'crypto', utilizationCapBps: 2_500 },
  { allocated: 260, idleBufferBps: 4_000, nav: 720, pnl: -6, rewards: 24, riskTier: 'aggressive', slug: 'politics', utilizationCapBps: 2_000 },
  { allocated: 92, idleBufferBps: 3_200, nav: 260, pnl: 3, rewards: 9, riskTier: 'standard', slug: 'esports', utilizationCapBps: 2_800 },
  { allocated: 158, idleBufferBps: 3_000, nav: 520, pnl: 5, rewards: 13, riskTier: 'standard', slug: 'finance', utilizationCapBps: 2_500 },
  { allocated: 168, idleBufferBps: 4_200, nav: 410, pnl: -9, rewards: 16, riskTier: 'aggressive', slug: 'geopolitics', utilizationCapBps: 2_000 },
  { allocated: 102, idleBufferBps: 3_200, nav: 360, pnl: 2, rewards: 10, riskTier: 'standard', slug: 'tech', utilizationCapBps: 2_500 },
  { allocated: 82, idleBufferBps: 3_000, nav: 300, pnl: 1, rewards: 8, riskTier: 'standard', slug: 'culture', utilizationCapBps: 2_600 },
  { allocated: 96, idleBufferBps: 3_800, nav: 280, pnl: 4, rewards: 7, riskTier: 'standard', slug: 'world', utilizationCapBps: 2_400 },
  { allocated: 105, idleBufferBps: 3_400, nav: 340, pnl: 2, rewards: 8, riskTier: 'conservative', slug: 'economy', utilizationCapBps: 2_400 },
  { allocated: 72, idleBufferBps: 3_500, nav: 190, pnl: -2, rewards: 6, riskTier: 'standard', slug: 'weather', utilizationCapBps: 2_300 },
  { allocated: 180, idleBufferBps: 4_000, nav: 450, pnl: -4, rewards: 19, riskTier: 'aggressive', slug: 'elections', utilizationCapBps: 2_000 },
  { allocated: 38, idleBufferBps: 3_000, nav: 120, pnl: 1, rewards: 3, riskTier: 'conservative', slug: 'mentions', utilizationCapBps: 2_200 },
] as const

function buildSamplePools(): LabPool[] {
  return SAMPLE_POOL_CONFIGS.map((config) => {
    const navAmountMicro = BigInt(config.nav) * MICRO
    const allocatedAmountMicro = BigInt(config.allocated) * MICRO
    const idleAmountMicro = navAmountMicro > allocatedAmountMicro ? navAmountMicro - allocatedAmountMicro : navAmountMicro / 2n
    const userPrincipalAmountMicro = BigInt(Math.max(20, Math.round(config.nav * 0.12))) * MICRO
    const realizedPnlAmountMicro = BigInt(config.pnl) * MICRO
    const label = categoryLabel(config.slug)

    return {
      activeStrategyAllocations: [
        {
          allocatedAmountMicro: allocatedAmountMicro / 3n,
          currentExposureAmountMicro: allocatedAmountMicro / 6n,
          marketConditionId: `sample-${config.slug}-market`,
          marketSlug: `sample-${config.slug}-market`,
          usedAmountMicro: allocatedAmountMicro / 5n,
        },
      ],
      allocatedAmountMicro,
      badDebtAmountMicro: 0n,
      categorySlug: config.slug,
      feeAmountMicro: 0n,
      id: `sample-${config.slug}`,
      idleAmountMicro,
      idleBufferBps: config.idleBufferBps,
      lastFinalizedAt: new Date().toISOString(),
      name: `${label}板块流动性池`,
      navAmountMicro,
      navStale: false,
      openOrderAmountMicro: 0n,
      pendingDeposits: [],
      positionMarkAmountMicro: allocatedAmountMicro / 8n,
      realizedPnlAmountMicro,
      rewardsAccruedAmountMicro: BigInt(config.rewards) * MICRO,
      riskBlocked: false,
      riskTier: config.riskTier,
      singleMarketCapBps: config.riskTier === 'aggressive' ? 350 : config.riskTier === 'conservative' ? 400 : 500,
      singleOutcomeCapBps: config.riskTier === 'aggressive' ? 200 : config.riskTier === 'conservative' ? 250 : 300,
      slug: config.slug,
      status: 'sample',
      totalSharesMicro: navAmountMicro - realizedPnlAmountMicro,
      unrealizedPnlAmountMicro: 0n,
      userPrincipalAmountMicro,
      userShareLots: [createUnlockedShareLot({
        principalAmountMicro: userPrincipalAmountMicro,
        sharesMicro: userPrincipalAmountMicro,
      })],
      userSharesMicro: userPrincipalAmountMicro,
      utilizationCapBps: config.utilizationCapBps,
      withdrawalLiabilityAmountMicro: 0n,
    }
  })
}

function toNavState(pool: LabPool): PoolNavState {
  return {
    allocatedAmountMicro: pool.allocatedAmountMicro,
    badDebtAmountMicro: pool.badDebtAmountMicro,
    feeAmountMicro: pool.feeAmountMicro,
    idleAmountMicro: pool.idleAmountMicro,
    navAmountMicro: pool.navAmountMicro,
    openOrderAmountMicro: pool.openOrderAmountMicro,
    positionMarkAmountMicro: pool.positionMarkAmountMicro,
    realizedPnlAmountMicro: pool.realizedPnlAmountMicro,
    rewardsAccruedAmountMicro: pool.rewardsAccruedAmountMicro,
    totalSharesMicro: pool.totalSharesMicro,
    unrealizedPnlAmountMicro: pool.unrealizedPnlAmountMicro,
    withdrawalLiabilityAmountMicro: pool.withdrawalLiabilityAmountMicro,
  }
}

function applyNavState(pool: LabPool, next: PoolNavState): LabPool {
  return {
    ...pool,
    allocatedAmountMicro: next.allocatedAmountMicro,
    badDebtAmountMicro: next.badDebtAmountMicro,
    feeAmountMicro: next.feeAmountMicro,
    idleAmountMicro: next.idleAmountMicro,
    navAmountMicro: next.navAmountMicro,
    openOrderAmountMicro: next.openOrderAmountMicro,
    positionMarkAmountMicro: next.positionMarkAmountMicro,
    realizedPnlAmountMicro: next.realizedPnlAmountMicro,
    rewardsAccruedAmountMicro: next.rewardsAccruedAmountMicro,
    totalSharesMicro: next.totalSharesMicro,
    unrealizedPnlAmountMicro: next.unrealizedPnlAmountMicro,
    withdrawalLiabilityAmountMicro: next.withdrawalLiabilityAmountMicro,
  }
}

function calculateLabPoolState(pool: LabPool) {
  return calculatePoolState({
    activeStrategyAllocations: pool.activeStrategyAllocations,
    allocatedAmountMicro: pool.allocatedAmountMicro,
    idleAmountMicro: pool.idleAmountMicro,
    idleBufferBps: pool.idleBufferBps,
    navAmountMicro: pool.navAmountMicro,
    singleMarketCapBps: pool.singleMarketCapBps,
    singleOutcomeCapBps: pool.singleOutcomeCapBps,
    totalSharesMicro: pool.totalSharesMicro,
    userPosition: {
      principalAmountMicro: pool.userPrincipalAmountMicro,
      sharesMicro: pool.userSharesMicro,
    },
    utilizationCapBps: pool.utilizationCapBps,
    withdrawalLiabilityAmountMicro: pool.withdrawalLiabilityAmountMicro,
  })
}

function MetricCard({
  icon: Icon,
  label,
  sublabel,
  tone = 'neutral',
  value,
}: {
  icon: LabIcon
  label: string
  sublabel?: string
  tone?: 'good' | 'neutral' | 'risk'
  value: string
}) {
  return (
    <Card className="bal-card bal-metric-card">
      <CardContent className="bal-metric-body">
        <div className="bal-truncate">
          <div className="bal-label">{label}</div>
          <div
            className={cn('bal-metric-value tabular-nums', {
              'bal-negative': tone === 'risk',
              'bal-positive': tone === 'good',
            })}
          >
            {value}
          </div>
          {sublabel ? <div className="bal-metric-subtitle">{sublabel}</div> : null}
        </div>
        <div className="bal-icon-box" aria-hidden="true">
          <Icon />
        </div>
      </CardContent>
    </Card>
  )
}

function DataTile({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: 'good' | 'neutral' | 'risk'
  value: string
}) {
  return (
    <div className="bal-data-tile">
      <div className="bal-data-label">{label}</div>
      <div
        className={cn('bal-data-value bal-truncate tabular-nums', {
          'bal-negative': tone === 'risk',
          'bal-positive': tone === 'good',
        })}
      >
        {value}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: 'good' | 'neutral' | 'risk'
  value: string
}) {
  return (
    <div className="bal-info-row">
      <span className="bal-truncate">{label}</span>
      <span
        className={cn('tabular-nums', {
          'bal-negative': tone === 'risk',
          'bal-positive': tone === 'good',
        })}
      >
        {value}
      </span>
    </div>
  )
}

function CapitalCompositionBar({
  allocatedAmountMicro,
  idleAmountMicro,
  navAmountMicro,
  reservedAmountMicro,
}: {
  allocatedAmountMicro: bigint
  idleAmountMicro: bigint
  navAmountMicro: bigint
  reservedAmountMicro: bigint
}) {
  const segments = [
    {
      className: 'bal-bg-idle',
      label: 'Idle',
      value: idleAmountMicro,
    },
    {
      className: 'bal-bg-bot',
      label: '策略',
      value: allocatedAmountMicro,
    },
    {
      className: 'bal-bg-risk',
      label: '占用',
      value: reservedAmountMicro,
    },
  ]

  return (
    <div>
      <div className="bal-composition-track">
        {segments.map((segment) => {
          const width = navAmountMicro > 0n
            ? `${Math.max(0, Number(calculateBpsFromAmount(segment.value, navAmountMicro)) / 100)}%`
            : '0%'

          return (
            <div
              key={segment.label}
              className={cn('bal-composition-segment', segment.className)}
              style={{ width }}
            />
          )
        })}
      </div>
      <div className="bal-legend-grid">
        {segments.map(segment => (
          <div key={segment.label} className="bal-legend-item">
            <div className="bal-mini-token">
              <span className={cn('bal-dot', segment.className)} />
              <span className="bal-truncate">{segment.label}</span>
              <span className="bal-legend-value tabular-nums">
                {formatBps(calculateBpsFromAmount(segment.value, navAmountMicro))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CapacityBar({
  label,
  valueBps,
}: {
  label: string
  valueBps: bigint
}) {
  const width = `${Math.min(100, Number(valueBps) / 100)}%`

  return (
    <div>
      <div className="bal-info-row">
        <span>{label}</span>
        <strong className="tabular-nums">{formatBps(valueBps)}</strong>
      </div>
      <div className="bal-progress-track">
        <div className="bal-progress-fill bal-bg-bot" style={{ width }} />
      </div>
    </div>
  )
}

export default function LiquidityLabClient({
  basePath = '/liquidity-lab-standalone',
  initialPoolSlug,
  initialPools,
  surface = 'full',
}: LiquidityLabClientProps) {
  const { open: openWallet } = useAppKit()
  const initial = useMemo(
    () => initialPools.length > 0 ? initialPools.map(fromSerialized) : buildSamplePools(),
    [initialPools],
  )
  const samplePools = useMemo(() => buildSamplePools(), [])
  const initialSelectedPool = initial.find(candidate => (
    candidate.id === initialPoolSlug
    || candidate.slug === initialPoolSlug
    || candidate.categorySlug === initialPoolSlug
  ))
  const [pools, setPools] = useState(initial)
  const [withdrawalRequests, setWithdrawalRequests] = useState<LabWithdrawalRequest[]>([])
  const [labNow, setLabNow] = useState(() => new Date())
  const [mode, setMode] = useState<LabMode>('chain')
  const [operationMode, setOperationMode] = useState<OperationMode>('add')
  const [poolSearch, setPoolSearch] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [selectedPoolId, setSelectedPoolId] = useState(initialSelectedPool?.id ?? initial[0]?.id ?? '')
  const [depositAmount, setDepositAmount] = useState('100')
  const [withdrawAmount, setWithdrawAmount] = useState('25')
  const [rewardAmount, setRewardAmount] = useState('10')
  const [botPnlAmount, setBotPnlAmount] = useState('-5')
  const [botAllocationAmount, setBotAllocationAmount] = useState('42')
  const [botMarketId, setBotMarketId] = useState('sample-sports-market')
  const [lastAction, setLastAction] = useState<LastAction>({
    label: '已连接 X Layer 链上流动性池',
    tone: 'neutral',
  })
  const isChainMode = mode === 'chain'
  const isLiveMode = mode === 'live'

  const pool = pools.find(candidate => candidate.id === selectedPoolId) ?? pools[0]
  const poolState = pool ? calculateLabPoolState(pool) : null
  const chainLiquidity = useXLayerLiquidityVault({
    openWallet,
    selectedPoolSlug: pool?.categorySlug ?? pool?.slug ?? initialPoolSlug,
  })
  const isPending = pendingAction !== null || chainLiquidity.isSubmitting
  const assetSymbol = chainLiquidity.assetSymbol || 'USDT0'

  useEffect(() => {
    if (!isChainMode) {
      return
    }

    setPools(current => current.map((candidate) => {
      const vaultSlug = getPoolVaultSlug(candidate)
      const summary = vaultSlug ? chainLiquidity.poolSummaries[vaultSlug] : null
      if (!summary) {
        return candidate
      }

      const selectedState = chainLiquidity.selectedState?.slug === summary.slug
        ? chainLiquidity.selectedState
        : null

      return applyOnchainSummaryToPool({
        epochSeconds: chainLiquidity.epochSeconds,
        pool: candidate,
        selectedState,
        summary,
      })
    }))
  }, [
    chainLiquidity.epochSeconds,
    chainLiquidity.poolSummaries,
    chainLiquidity.selectedState,
    isChainMode,
  ])

  useEffect(() => {
    if (!isChainMode || !pool || !chainLiquidity.selectedState) {
      return
    }

    setWithdrawalRequests(current => [
      ...current.filter(request => !(request.id.startsWith('chain-') && request.poolId === pool.id)),
      ...toOnchainWithdrawalRequests({
        poolId: pool.id,
        selectedState: chainLiquidity.selectedState!,
      }),
    ])
  }, [chainLiquidity.selectedState, isChainMode, pool])

  function updateSelectedPool(updater: (pool: LabPool) => LabPool, action: LastAction) {
    if (!pool) {
      return
    }

    setPools(current => current.map(candidate => (
      candidate.id === pool.id ? updater(candidate) : candidate
    )))
    setLastAction(action)
  }

  function runAction(action: () => void) {
    try {
      action()
    }
    catch (error) {
      setLastAction({
        label: error instanceof Error ? error.message : 'Action failed',
        tone: 'risk',
      })
    }
  }

  function applyLiveResult(result: LiquidityLabActionResult, fallbackMessage: string) {
    if (result.error) {
      setLastAction({ label: result.error, tone: 'risk' })
      return
    }
    if (result.pools.length === 0) {
      setLastAction({
        label: result.message ?? '没有找到实盘流动性池。可以先初始化默认池子，或继续使用演示模式。',
        tone: 'risk',
      })
      return
    }

    const nextPools = result.pools.map(fromSerialized)
    setPools(nextPools)
    setWithdrawalRequests(result.withdrawalRequests ?? [])
    setMode('live')
    setSelectedPoolId(current => (
      nextPools.some(candidate => candidate.id === current)
        ? current
        : nextPools[0]!.id
    ))
    setLastAction({
      label: result.message ?? fallbackMessage,
      tone: 'good',
    })
  }

  async function runLiveAction(
    pending: PendingAction,
    action: () => Promise<LiquidityLabActionResult>,
    fallbackMessage: string,
  ) {
    setPendingAction(pending)
    try {
      applyLiveResult(await action(), fallbackMessage)
    }
    catch (error) {
      setLastAction({
        label: error instanceof Error ? error.message : '实盘流动性操作失败。',
        tone: 'risk',
      })
    }
    finally {
      setPendingAction(null)
    }
  }

  async function handleLoadLive() {
    await runLiveAction(
      'load',
      () => listLiquidityLabPoolsAction(),
      '已加载实盘资金池状态。',
    )
  }

  async function handleSeedLivePools() {
    await runLiveAction(
      'seed',
      () => seedLiquidityLabPoolsAction(),
      '默认流动性池已初始化。',
    )
  }

  async function handleLoadChain() {
    setMode('chain')
    setPendingAction('load')
    try {
      await Promise.all([
        chainLiquidity.refreshAll(),
        chainLiquidity.refreshSelected(),
      ])
      setLastAction({
        label: '已刷新 X Layer 链上流动性池',
        tone: 'good',
      })
    }
    catch (error) {
      setLastAction({
        label: error instanceof Error ? error.message : '链上流动性池刷新失败。',
        tone: 'risk',
      })
    }
    finally {
      setPendingAction(null)
    }
  }

  function handleReset() {
    if (isChainMode) {
      void handleLoadChain()
      return
    }

    if (isLiveMode) {
      void handleLoadLive()
      return
    }

    setPools(samplePools)
    setWithdrawalRequests([])
    setLabNow(new Date())
    setSelectedPoolId(samplePools[0]?.id ?? '')
    setOperationMode('add')
    setLastAction({
      label: '已重置演示资金池',
      tone: 'neutral',
    })
  }

  function focusLiquidityActions(nextMode: OperationMode = operationMode) {
    setOperationMode(nextMode)
    window.requestAnimationFrame(() => {
      const target = document.querySelector('[data-lab-quick-ops]') ?? document.querySelector('[data-lab-ops]')
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

  function handleSelectPoolForAction(candidate: LabPool, nextMode: OperationMode = 'add') {
    setSelectedPoolId(candidate.id)
    focusLiquidityActions(nextMode)
    setLastAction({
      label: `已选择 ${poolDisplayName(candidate)}`,
      tone: 'neutral',
    })
  }

  async function handleDeposit() {
    if (isChainMode) {
      setPendingAction('deposit')
      try {
        const amountMicro = parseNonNegativeMicroInput(depositAmount)
        const ok = await chainLiquidity.requestDeposit(amountMicro)
        if (ok) {
          setLastAction({
            label: `存入 ${formatMicro(amountMicro)} 已上链，下一次 daily NAV 后可领取 LP`,
            tone: 'good',
          })
        }
      }
      catch (error) {
        setLastAction({
          label: error instanceof Error ? error.message : '存入失败。',
          tone: 'risk',
        })
      }
      finally {
        setPendingAction(null)
      }
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'deposit',
        () => depositLiquidityLabAction({
          amountMicro: parseMicroInput(depositAmount).toString(),
          poolId: pool!.id,
        }),
        '存入已记录。',
      )
      return
    }

    runAction(() => {
      const amountMicro = parseNonNegativeMicroInput(depositAmount)
      if (amountMicro <= 0n) {
        throw new Error('存入金额必须大于 0。')
      }
      const requestedAt = labNow

      updateSelectedPool(current => ({
        ...current,
        pendingDeposits: [
          ...current.pendingDeposits,
          {
            accountId: SAMPLE_ACCOUNT_ID,
            amountMicro,
            id: `sample-deposit-${requestedAt.getTime()}`,
            requestedAt: requestedAt.toISOString(),
          },
        ],
      }), {
        label: `存入 ${formatMicro(amountMicro)} 已进入 pending，下一次 daily NAV 结算后 mint LP`,
        tone: 'good',
      })
    })
  }

  async function handleWithdraw() {
    if (isChainMode) {
      setPendingAction('withdraw')
      try {
        const sharesMicro = parseNonNegativeMicroInput(withdrawAmount)
        const ok = await chainLiquidity.requestWithdraw(sharesMicro)
        if (ok) {
          setLastAction({
            label: `${formatMicroUnits(sharesMicro)} ${categoryLabel(pool!.categorySlug)} LP 已进入链上退出队列`,
            tone: 'good',
          })
        }
      }
      catch (error) {
        setLastAction({
          label: error instanceof Error ? error.message : '退出失败。',
          tone: 'risk',
        })
      }
      finally {
        setPendingAction(null)
      }
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'withdraw',
        () => withdrawLiquidityLabAction({
          amountMicro: parseMicroInput(withdrawAmount).toString(),
          poolId: pool!.id,
        }),
        '退出申请已提交。',
      )
      return
    }

    runAction(() => {
      const sharesMicro = parseNonNegativeMicroInput(withdrawAmount)
      const unlockedSharesMicro = getUnlockedShares(pool!, withdrawalRequests, labNow)
      const request = buildAsyncWithdrawalRequest({
        accountId: SAMPLE_ACCOUNT_ID,
        id: `sample-withdraw-${labNow.getTime()}`,
        requestedAt: labNow,
        sharesMicro,
        unlockedSharesMicro,
      })
      const estimatedAssetsMicro = calculateAssetsAtSharePrice({
        sharePriceMicro: poolState!.sharePriceMicro,
        sharesMicro,
      })
      const claimableAt = getNextDailyNavFinalizationTime(labNow)
      setWithdrawalRequests(current => [
        {
          assetsAmountMicro: estimatedAssetsMicro.toString(),
          claimableAssetsMicro: '0',
          claimableAt: claimableAt.toISOString(),
          completedAt: null,
          createdAt: labNow.toISOString(),
          epochId: request.epochId.toString(),
          id: request.id,
          immediateAmountMicro: '0',
          poolId: pool!.id,
          queuedAmountMicro: estimatedAssetsMicro.toString(),
          remainingSharesMicro: sharesMicro.toString(),
          requestedAmountMicro: null,
          requestedAt: labNow.toISOString(),
          sharePriceMicro: poolState!.sharePriceMicro.toString(),
          sharesToBurnMicro: sharesMicro.toString(),
          status: request.status,
        },
        ...current,
      ])
      setLastAction({
        label: `${formatMicroUnits(sharesMicro)} ${categoryLabel(pool!.categorySlug)} LP 已锁定，下一次 daily NAV 结算后按新 NAV 处理`,
        tone: 'neutral',
      })
    })
  }

  async function handleRewardAccrual() {
    if (isChainMode) {
      setLastAction({
        label: '链上奖励需要进入 NAV reporter 流程，普通 LP 页面不直接改账。',
        tone: 'neutral',
      })
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'reward',
        () => accrueLiquidityRewardLabAction({
          amountMicro: parseMicroInput(rewardAmount).toString(),
          poolId: pool!.id,
        }),
        '奖励已计入资金池。',
      )
      return
    }

    runAction(() => {
      const amountMicro = parseMicroInput(rewardAmount)
      const adjustment = applyPoolNavDelta({
        delta: {
          rewardsAccruedAmountMicro: amountMicro,
        },
        state: toNavState(pool!),
      })

      updateSelectedPool(current => applyNavState(current, adjustment.next), {
        label: `奖励 ${formatMicro(amountMicro)} 已计入 NAV`,
        tone: 'good',
      })
    })
  }

  async function handleBotSettlement() {
    if (isChainMode) {
      setLastAction({
        label: '链上做市 PnL 由 reporter 阈值签名进入 NAV，不在用户页手动结算。',
        tone: 'neutral',
      })
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'settle',
        () => settleLiquidityBotPnlLabAction({
          amountMicro: parseMicroInput(botPnlAmount).toString(),
          poolId: pool!.id,
        }),
        '做市 PnL 已结算。',
      )
      return
    }

    runAction(() => {
      const amountMicro = parseMicroInput(botPnlAmount)
      const adjustment = applyPoolNavDelta({
        delta: {
          realizedPnlAmountMicro: amountMicro,
        },
        state: toNavState(pool!),
      })

      updateSelectedPool(current => applyNavState(current, adjustment.next), {
        label: `做市 PnL ${formatMicro(amountMicro, { signed: true })}`,
        tone: amountMicro < 0n ? 'risk' : 'good',
      })
    })
  }

  async function handleBotAllocation() {
    if (isChainMode) {
      setLastAction({
        label: '链上 bot 额度由 strategy manager 控制，用户页只展示结果。',
        tone: 'neutral',
      })
      return
    }

    const normalizedMarketId = botMarketId.trim()
    if (!normalizedMarketId) {
      setLastAction({ label: '需要填写市场 condition id。', tone: 'risk' })
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'allocation',
        () => allocateLiquidityBotCapitalLabAction({
          amountMicro: parseNonNegativeMicroInput(botAllocationAmount).toString(),
          marketConditionId: normalizedMarketId,
          marketSlug: normalizedMarketId,
          poolId: pool!.id,
        }),
        '做市额度已更新。',
      )
      return
    }

    runAction(() => {
      const amountMicro = parseNonNegativeMicroInput(botAllocationAmount)
      const existingAllocation = pool!.activeStrategyAllocations.find(
        allocation => allocation.marketConditionId === normalizedMarketId,
      ) ?? null
      const capitalDelta = calculateStrategyAllocationCapitalDelta({
        currentAllocatedAmountMicro: existingAllocation?.allocatedAmountMicro ?? 0n,
        currentStatus: existingAllocation ? 'active' : 'paused',
        nextAllocatedAmountMicro: amountMicro,
        nextStatus: amountMicro > 0n ? 'active' : 'paused',
      })

      if (capitalDelta.allocationDeltaMicro > 0n) {
        const availableIdleMicro = calculateImmediateWithdrawalCapacity({
          idleAmountMicro: pool!.idleAmountMicro,
          idleBufferBps: pool!.idleBufferBps,
          navAmountMicro: pool!.navAmountMicro,
          withdrawalLiabilityAmountMicro: pool!.withdrawalLiabilityAmountMicro,
        })
        if (capitalDelta.allocationDeltaMicro > availableIdleMicro) {
          throw new Error('策略额度超过当前可用闲置资金。')
        }
      }

      const adjustment = capitalDelta.allocationDeltaMicro === 0n
        ? null
        : applyPoolNavDelta({
            delta: {
              allocatedAmountMicro: capitalDelta.allocationDeltaMicro,
              idleAmountMicro: -capitalDelta.allocationDeltaMicro,
            },
            state: toNavState(pool!),
          })

      updateSelectedPool((current) => {
        const nextAllocations = current.activeStrategyAllocations.filter(
          allocation => allocation.marketConditionId !== normalizedMarketId,
        )
        if (amountMicro > 0n) {
          nextAllocations.push({
            allocatedAmountMicro: amountMicro,
            currentExposureAmountMicro: existingAllocation?.currentExposureAmountMicro ?? 0n,
            marketConditionId: normalizedMarketId,
            marketSlug: normalizedMarketId,
            usedAmountMicro: existingAllocation?.usedAmountMicro ?? 0n,
          })
        }

        return {
          ...(adjustment ? applyNavState(current, adjustment.next) : current),
          activeStrategyAllocations: nextAllocations,
        }
      }, {
        label: `已把 ${normalizedMarketId} 的做市额度设置为 ${formatMicro(amountMicro)}`,
        tone: capitalDelta.allocationDeltaMicro < 0n ? 'neutral' : 'good',
      })
    })
  }

  async function handleClaimDeposit(epoch: bigint) {
    if (!isChainMode) {
      return
    }

    setPendingAction('claim')
    try {
      const ok = await chainLiquidity.claimDeposit(epoch)
      if (ok) {
        setLastAction({ label: 'LP 份额已从链上领取。', tone: 'good' })
      }
    }
    catch (error) {
      setLastAction({
        label: error instanceof Error ? error.message : '领取 LP 失败。',
        tone: 'risk',
      })
    }
    finally {
      setPendingAction(null)
    }
  }

  async function handleClaimWithdrawal(request: LabWithdrawalRequest) {
    if (isChainMode) {
      const requestId = request.chainRequestId
      if (!requestId) {
        setLastAction({ label: '没有找到链上退出 requestId。', tone: 'risk' })
        return
      }

      setPendingAction('claim')
      try {
        const ok = await chainLiquidity.claimWithdraw(BigInt(requestId))
        if (ok) {
          setLastAction({ label: '退出资金已从链上领取。', tone: 'good' })
        }
      }
      catch (error) {
        setLastAction({
          label: error instanceof Error ? error.message : '领取失败。',
          tone: 'risk',
        })
      }
      finally {
        setPendingAction(null)
      }
      return
    }

    if (isLiveMode) {
      await runLiveAction(
        'claim',
        () => claimLiquidityWithdrawalLabAction({ requestId: request.id }),
        '退出资金已领取。',
      )
      return
    }

    const claimableAssetsMicro = BigInt(request.claimableAssetsMicro ?? request.immediateAmountMicro)
    const remainingSharesMicro = BigInt(request.remainingSharesMicro ?? request.sharesToBurnMicro)
    if (claimableAssetsMicro <= 0n) {
      setLastAction({ label: '这笔退出申请还没有可领取金额。', tone: 'risk' })
      return
    }

    const now = labNow.toISOString()
    setWithdrawalRequests(current => current.map(candidate => (
      candidate.id === request.id
        ? {
            ...candidate,
            assetsAmountMicro: candidate.queuedAmountMicro,
            claimableAssetsMicro: '0',
            completedAt: remainingSharesMicro > 0n ? null : now,
            immediateAmountMicro: '0',
            status: remainingSharesMicro > 0n ? 'queued' : 'completed',
          }
        : candidate
    )))
    setLastAction({ label: `已领取 ${formatMicro(claimableAssetsMicro)}，剩余 shares 继续按 NAV 排队。`, tone: 'good' })
  }

  if (!pool || !poolState) {
    return null
  }

  const pnlTone = poolState.userPnlMicro < 0n ? 'risk' : poolState.userPnlMicro > 0n ? 'good' : 'neutral'
  const reservedAmountMicro = pool.openOrderAmountMicro + pool.positionMarkAmountMicro
  const poolWithdrawalRequests = withdrawalRequests.filter(request => request.poolId === pool.id)
  const openWithdrawalRequests = poolWithdrawalRequests.filter(request => (
    request.status !== 'completed' && request.status !== 'cancelled'
  ))
  const queuedWithdrawalAmountMicro = openWithdrawalRequests.reduce(
    (sum, request) => sum + BigInt(request.queuedAmountMicro),
    0n,
  )
  const pendingDepositAmountMicro = getPendingDepositAmount(pool)
  const lockedSharesMicro = getLockedShares(pool, labNow)
  const queuedWithdrawalSharesMicro = getRemainingWithdrawalShares(withdrawalRequests, pool.id)
  const claimableWithdrawalAssetsMicro = getClaimableWithdrawalAssets(withdrawalRequests, pool.id)
  const unlockedSharesMicro = getUnlockedShares(pool, withdrawalRequests, labNow)
  const claimableWithdrawalCount = openWithdrawalRequests.filter(request => (
    BigInt(request.claimableAssetsMicro ?? request.immediateAmountMicro) > 0n
  )).length
  const idleBufferTone = poolState.idleAmountMicro >= poolState.idleBufferTargetMicro ? 'good' : 'risk'
  const botPnlTone = pool.realizedPnlAmountMicro < 0n
    ? 'risk'
    : pool.realizedPnlAmountMicro > 0n
      ? 'good'
      : 'neutral'
  const lastActionClass = cn('bal-callout', {
    'is-good': lastAction.tone === 'good',
    'is-risk': lastAction.tone === 'risk',
  })
  const depositPreview = (() => {
    try {
      return previewDeposit({
        depositAmountMicro: parseNonNegativeMicroInput(depositAmount),
        navAmountMicro: pool.navAmountMicro,
        totalSharesMicro: pool.totalSharesMicro,
      })
    }
    catch {
      return null
    }
  })()
  const depositAmountMicroPreview = (() => {
    try {
      return parseNonNegativeMicroInput(depositAmount)
    }
    catch {
      return null
    }
  })()
  const withdrawSharesPreview = (() => {
    try {
      return parseNonNegativeMicroInput(withdrawAmount)
    }
    catch {
      return null
    }
  })()
  const withdrawalAssetsPreviewMicro = withdrawSharesPreview
    ? calculateAssetsAtSharePrice({
        sharePriceMicro: poolState.sharePriceMicro,
        sharesMicro: withdrawSharesPreview,
      })
    : null
  const estimatedAprBps = estimatedAprBpsForPool(pool)
  const weeklyRewardEstimateMicro = (poolState.userAssetsMicro * BigInt(estimatedAprBps)) / 520_000n
  const normalizedPoolSearch = poolSearch.trim().toLowerCase()
  const filteredPools = pools.filter((candidate) => {
    if (normalizedPoolSearch.length === 0) {
      return true
    }

    return poolDisplayName(candidate).toLowerCase().includes(normalizedPoolSearch)
      || categoryLabel(candidate.categorySlug).toLowerCase().includes(normalizedPoolSearch)
      || candidate.name.toLowerCase().includes(normalizedPoolSearch)
      || candidate.slug.toLowerCase().includes(normalizedPoolSearch)
      || candidate.categorySlug.toLowerCase().includes(normalizedPoolSearch)
  })
  const totalNavMicro = pools.reduce((sum, candidate) => sum + calculateLabPoolState(candidate).navAmountMicro, 0n)
  const totalVolumeMicro = pools.reduce((sum, candidate) => (
    sum + (calculateLabPoolState(candidate).activeAllocatedAmountMicro * 18n)
  ), 0n)
  const lpPerAssetRate = poolState.sharePriceMicro > 0n
    ? Number(MICRO) / Number(poolState.sharePriceMicro)
    : 0
  const poolLpLabel = `${categoryLabel(pool.categorySlug)} LP`
  const chainWithdrawals = isChainMode
    ? chainLiquidity.selectedState?.withdrawals ?? []
    : []
  const chainClaimableWithdrawals = chainWithdrawals.filter(request => request.assetsClaimable > 0n && !request.completed)
  const chainPendingDeposits = isChainMode
    ? chainLiquidity.selectedState?.deposits.filter(deposit => deposit.assets > 0n && !deposit.claimed) ?? []
    : []
  const lockDurationLabel = formatDuration(chainLiquidity.lockSeconds)
  const trimmedBasePath = basePath.trim().replace(/\/+$/, '')
  const normalizedBasePath = trimmedBasePath.length > 0 ? trimmedBasePath : '/liquidity-lab-standalone'

  function swapHrefForPool(candidate: LabPool): Route {
    return `${normalizedBasePath}/swap?pool=${encodeURIComponent(candidate.slug)}` as Route
  }

  function renderNav(activeSurface: 'pools' | 'swap') {
    return (
      <nav className="bfi-nav" data-lab-hero>
        <Link className="bfi-brand" href={normalizedBasePath as Route}>
          <span className="bfi-logo" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>{PLATFORM_NAME}</span>
        </Link>

        <div className="bfi-nav-links">
          <Link className={cn(activeSurface === 'pools' && 'is-active')} href={normalizedBasePath as Route}>流动性池</Link>
          <Link
            className={cn(activeSurface === 'swap' && 'is-active')}
            href={`${normalizedBasePath}/swap?pool=${encodeURIComponent(pool.slug)}` as Route}
          >
            交换
          </Link>
        </div>

        <div className="bfi-nav-actions" data-lab-actions>
          <Button className="bfi-wallet-button" variant="outline" onClick={() => void openWallet()}>
            <WalletIcon />
            {formatShortAddress(chainLiquidity.accountAddress)}
          </Button>
          <Button
            className="bfi-connect-button"
            variant="outline"
            onClick={handleReset}
            disabled={isPending}
            data-lab-refresh
          >
            <RefreshCwIcon />
            刷新
          </Button>
          <Button
            className="bfi-chip-button"
            variant="outline"
            onClick={() => void handleSeedLivePools()}
            disabled={isPending}
          >
            {pendingAction === 'seed' ? '初始化中' : '初始化默认池'}
          </Button>
        </div>
      </nav>
    )
  }

  if (surface === 'swap') {
    return (
      <main className="bfi-page bfi-swap-page" data-liquidity-lab>
        {renderNav('swap')}

        <section className="bfi-swap-shell">
          <div className="bfi-swap-card" data-lab-swap>
            <div className="bfi-swap-head">
              <h1>{operationMode === 'remove' ? '退出' : '交换'}</h1>
              <div className="bfi-swap-tools">
                <span>
                  滑点
                  {' '}
                  {formatBps(SWAP_SLIPPAGE_BPS)}
                </span>
                <SettingsIcon />
              </div>
            </div>

            <label className="bfi-pool-select-row" htmlFor="liquidity-swap-pool">
              <span>流动性池</span>
              <select
                id="liquidity-swap-pool"
                value={pool.id}
                onChange={event => setSelectedPoolId(event.target.value)}
              >
                {pools.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {categoryLabel(candidate.categorySlug)}
                    {' '}
                    LP
                  </option>
                ))}
              </select>
            </label>

            <div className="bal-segmented bfi-swap-tabs" role="group">
              <button
                type="button"
                onClick={() => setOperationMode('add')}
                className={cn('bal-tab', operationMode === 'add' && 'is-active')}
              >
                存入
              </button>
              <button
                type="button"
                onClick={() => setOperationMode('remove')}
                className={cn('bal-tab', operationMode === 'remove' && 'is-active')}
              >
                退出
              </button>
            </div>

            {operationMode === 'remove'
              ? (
                  <>
                    <div className="bfi-swap-token-card">
                      <div className="bfi-swap-token-top">
                        <Input
                          className="bfi-swap-amount-input"
                          inputMode="decimal"
                          value={withdrawAmount}
                          onChange={event => setWithdrawAmount(event.target.value)}
                        />
                        <span className="bal-token-pill">
                          <span className="bal-mini-symbol bal-bg-bot">LP</span>
                          {poolLpLabel}
                        </span>
                      </div>
                      <div className="bfi-swap-token-meta">
                        <span>可请求份额</span>
                        <span>{formatMicroUnits(unlockedSharesMicro)}</span>
                      </div>
                    </div>
                    <button className="bfi-swap-switch" type="button" aria-label="switch tokens">
                      <ArrowUpFromLineIcon />
                    </button>
                    <div className="bfi-swap-token-card">
                      <div className="bfi-swap-token-top">
                        <div className="bfi-swap-output">
                          {withdrawalAssetsPreviewMicro ? formatMicro(withdrawalAssetsPreviewMicro) : '$0.00'}
                        </div>
                        <span className="bal-token-pill">
                          <span className="bal-mini-symbol bal-bg-idle">{assetSymbol.slice(0, 4)}</span>
                          {assetSymbol}
                        </span>
                      </div>
                      <div className="bfi-swap-token-meta">
                        <span>下一次 daily NAV 估算</span>
                        <span>{withdrawalAssetsPreviewMicro ? formatMicro(withdrawalAssetsPreviewMicro) : '$0.00'}</span>
                      </div>
                    </div>
                    <div className="bfi-swap-details">
                      <InfoRow label="LP NAV" value={formatSharePrice(poolState.sharePriceMicro)} />
                      <InfoRow label="兑换率" value={`1 ${poolLpLabel} = ${formatSharePrice(poolState.sharePriceMicro)}`} />
                      <InfoRow
                        label="提现 capacity"
                        value={formatMicro(calculateAsyncWithdrawCapacity({
                          idleAmountMicro: pool.idleAmountMicro,
                          idleBufferBps: pool.idleBufferBps,
                          navAmountMicro: pool.navAmountMicro,
                          navStale: pool.navStale,
                          riskBlocked: pool.riskBlocked,
                          withdrawalLiabilityAmountMicro: pool.withdrawalLiabilityAmountMicro,
                        }))}
                      />
                      <InfoRow label="锁定份额" value={formatMicroUnits(lockedSharesMicro)} />
                      <InfoRow label="排队份额" value={formatMicroUnits(queuedWithdrawalSharesMicro)} />
                      <InfoRow label="池子 NAV" value={formatMicro(poolState.navAmountMicro)} />
                    </div>
                    <Button
                      className="bal-button bal-button-primary"
                      onClick={handleWithdraw}
                      disabled={isPending}
                      data-lab-withdraw-liquidity
                    >
                      {pendingAction === 'withdraw' ? '退出中' : '退出'}
                    </Button>
                    {chainClaimableWithdrawals.length > 0
                      ? (
                          <div className="bfi-chain-claims">
                            {chainClaimableWithdrawals.map(request => (
                              <div key={request.requestId.toString()} className="bfi-chain-claim-row">
                                <span>{`#${request.requestId.toString()} ${formatMicro(request.assetsClaimable)}`}</span>
                                <Button
                                  className="bal-button bal-button-secondary"
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => {
                                    void chainLiquidity.claimWithdraw(request.requestId)
                                  }}
                                >
                                  领取
                                </Button>
                              </div>
                            ))}
                          </div>
                        )
                      : null}
                  </>
                )
              : (
                  <>
                    <div className="bfi-swap-token-card">
                      <div className="bfi-swap-token-top">
                        <Input
                          className="bfi-swap-amount-input"
                          inputMode="decimal"
                          value={depositAmount}
                          onChange={event => setDepositAmount(event.target.value)}
                        />
                        <span className="bal-token-pill">
                          <span className="bal-mini-symbol bal-bg-idle">{assetSymbol.slice(0, 4)}</span>
                          {assetSymbol}
                        </span>
                      </div>
                      <div className="bfi-swap-token-meta">
                        <span>存入资产</span>
                        <span>{depositAmountMicroPreview ? formatMicro(depositAmountMicroPreview) : '$0.00'}</span>
                      </div>
                    </div>
                    <button className="bfi-swap-switch" type="button" aria-label="switch tokens">
                      <ArrowDownToLineIcon />
                    </button>
                    <div className="bfi-swap-token-card">
                      <div className="bfi-swap-token-top">
                        <div className="bfi-swap-output">
                          {depositPreview ? formatMicroUnits(depositPreview.shareAmountMicro) : '0.00'}
                        </div>
                        <span className="bal-token-pill">
                          <span className="bal-mini-symbol bal-bg-bot">LP</span>
                          {poolLpLabel}
                        </span>
                      </div>
                      <div className="bfi-swap-token-meta">
                        <span>daily NAV 后 mint</span>
                        <span>
                          {depositPreview ? `${formatMicroUnits(depositPreview.shareAmountMicro)} ${categoryLabel(pool.categorySlug)} LP` : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="bfi-swap-details">
                      <InfoRow label="LP NAV" value={formatSharePrice(poolState.sharePriceMicro)} />
                      <InfoRow label="兑换率" value={`1 ${assetSymbol} ≈ ${formatRate(lpPerAssetRate)} ${poolLpLabel}`} />
                      <InfoRow label="Pending 存款" value={formatMicro(pendingDepositAmountMicro)} />
                      <InfoRow label="Mint 后锁定" value={lockDurationLabel} />
                      <InfoRow label="预计年化" tone="good" value={formatBps(estimatedAprBps)} />
                      <InfoRow label="上次 NAV" value={formatShortDateTime(pool.lastFinalizedAt)} />
                      <InfoRow label="池子 NAV" value={formatMicro(poolState.navAmountMicro)} />
                    </div>
                    <Button
                      className="bal-button bal-button-primary"
                      onClick={handleDeposit}
                      disabled={isPending}
                      data-lab-add-liquidity
                    >
                      {pendingAction === 'deposit' ? '存入中' : '存入'}
                    </Button>
                    {chainPendingDeposits.length > 0
                      ? (
                          <div className="bfi-chain-claims">
                            {chainPendingDeposits.map(deposit => (
                              <div key={deposit.epoch.toString()} className="bfi-chain-claim-row">
                                <span>
                                  epoch
                                  {' '}
                                  {deposit.epoch.toString()}
                                  {' '}
                                  {formatMicro(deposit.assets)}
                                </span>
                                <Button
                                  className="bal-button bal-button-secondary"
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending || !deposit.claimable}
                                  onClick={() => {
                                    void handleClaimDeposit(deposit.epoch)
                                  }}
                                >
                                  {deposit.claimable ? '领取 LP' : '等待 NAV'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )
                      : null}
                  </>
                )}

            <div className={lastActionClass}>{lastAction.label}</div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="bfi-page" data-liquidity-lab>
      {renderNav('pools')}

      <section className="bfi-hero">
        <div className="bfi-hero-copy">
          <h1>
            在
            {' '}
            {PLATFORM_NAME}
            {' '}
            提供流动性
          </h1>
          <p>
            把资金存入板块池，由做市策略为预测市场提供深度，收益和风险按 LP 份额结算。
          </p>
        </div>
        {surface === 'full'
          ? (
              <div className="bfi-hero-action-panel" data-lab-hero-ops>
                <div className="bfi-panel-card bfi-hero-action-card">
                  <div className="bfi-panel-head">
                    <div>
                      <span className="bfi-quick-eyebrow">当前池子</span>
                      <h3>{poolDisplayName(pool)}</h3>
                    </div>
                    <span className="bal-badge">{assetSymbol}</span>
                  </div>

                  <div className="bal-segmented" role="group" data-lab-hero-operation-tabs>
                    <button
                      type="button"
                      onClick={() => setOperationMode('add')}
                      className={cn('bal-tab', operationMode === 'add' && 'is-active')}
                      data-hero-operation-mode="add"
                    >
                      存入
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationMode('remove')}
                      className={cn('bal-tab', operationMode === 'remove' && 'is-active')}
                      data-hero-operation-mode="remove"
                    >
                      退出
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationMode('manage')}
                      className={cn('bal-tab', operationMode === 'manage' && 'is-active')}
                      data-hero-operation-mode="manage"
                    >
                      管理
                    </button>
                  </div>

                  {operationMode === 'add'
                    ? (
                        <div className="bal-card-stack" data-lab-hero-operation>
                          <div className="bal-token-input">
                            <Label className="bal-token-label" htmlFor="hero-liquidity-deposit-amount">存入金额</Label>
                            <div className="bal-input-row">
                              <Input
                                className="bal-amount-input"
                                id="hero-liquidity-deposit-amount"
                                inputMode="decimal"
                                value={depositAmount}
                                onChange={event => setDepositAmount(event.target.value)}
                              />
                              <span className="bal-token-pill">
                                <span className="bal-mini-symbol bal-bg-idle">{assetSymbol.slice(0, 4)}</span>
                                {assetSymbol}
                              </span>
                            </div>
                          </div>
                          <div className="bal-action-summary">
                            <InfoRow label="份额净值" value={formatSharePrice(poolState.sharePriceMicro)} />
                            <InfoRow
                              label="daily NAV 后 mint"
                              value={depositPreview ? `${formatMicroUnits(depositPreview.shareAmountMicro)} ${categoryLabel(pool.categorySlug)} LP` : '-'}
                            />
                          </div>
                          <Button
                            className="bal-button bal-button-primary"
                            onClick={handleDeposit}
                            disabled={isPending}
                            data-lab-add-liquidity
                          >
                            <ArrowDownToLineIcon />
                            {pendingAction === 'deposit' ? '存入中' : '存入'}
                          </Button>
                        </div>
                      )
                    : null}

                  {operationMode === 'remove'
                    ? (
                        <div className="bal-card-stack" data-lab-hero-operation>
                          <div className="bal-token-input">
                            <Label className="bal-token-label" htmlFor="hero-liquidity-withdraw-amount">退出份额</Label>
                            <div className="bal-input-row">
                              <Input
                                className="bal-amount-input"
                                id="hero-liquidity-withdraw-amount"
                                inputMode="decimal"
                                value={withdrawAmount}
                                onChange={event => setWithdrawAmount(event.target.value)}
                              />
                              <span className="bal-token-pill">
                                <span className="bal-mini-symbol bal-bg-bot">LP</span>
                                LP
                              </span>
                            </div>
                          </div>
                          <div className="bal-action-summary">
                            <InfoRow
                              label="预估结算"
                              value={withdrawalAssetsPreviewMicro ? formatMicro(withdrawalAssetsPreviewMicro) : '-'}
                            />
                            <InfoRow
                              label="可请求份额"
                              value={formatMicroUnits(unlockedSharesMicro)}
                            />
                          </div>
                          <Button
                            className="bal-button bal-button-secondary"
                            variant="outline"
                            onClick={handleWithdraw}
                            disabled={isPending}
                            data-lab-withdraw-liquidity
                          >
                            <ArrowUpFromLineIcon />
                            {pendingAction === 'withdraw' ? '退出中' : '退出'}
                          </Button>
                        </div>
                      )
                    : null}

                  {operationMode === 'manage'
                    ? (
                        <div className="bal-card-stack" data-lab-hero-operation>
                          <div className="bal-action-summary">
                            <InfoRow label="总 TVL" value={formatMicro(totalNavMicro)} />
                            <InfoRow label="做市可用" value={formatMicro(poolState.availableBotCapacityMicro)} />
                            <InfoRow label="累计奖励" tone="good" value={formatMicro(pool.rewardsAccruedAmountMicro)} />
                          </div>
                          <Button className="bal-button bal-button-secondary" variant="outline" onClick={handleRewardAccrual} disabled={isPending}>
                            <SparklesIcon />
                            {pendingAction === 'reward' ? '计入中' : '计入奖励'}
                          </Button>
                        </div>
                      )
                    : null}
                </div>
              </div>
            )
          : (
              <div className="bfi-hero-stats">
                <div className="bfi-glass-stat">
                  <span>流动性池</span>
                  <strong>{pools.length}</strong>
                </div>
                <div className="bfi-glass-stat">
                  <span>TVL</span>
                  <strong>{formatMicro(totalNavMicro)}</strong>
                </div>
                <div className="bfi-glass-stat">
                  <span>24h 成交量</span>
                  <strong>{formatMicro(totalVolumeMicro)}</strong>
                </div>
              </div>
            )}
      </section>

      <section className="bfi-status-strip" data-lab-mode>
        <span className={cn('bfi-source-pill', mode !== 'sample' && 'is-live')}>
          {labModeLabel(mode)}
        </span>
        <span>
          份额净值
          {' '}
          <strong>{formatSharePrice(poolState.sharePriceMicro)}</strong>
        </span>
        <span>
          可请求份额
          {' '}
          <strong>{formatMicroUnits(unlockedSharesMicro)}</strong>
        </span>
        <span>
          Pending 存款
          {' '}
          <strong>{formatMicro(pendingDepositAmountMicro)}</strong>
        </span>
        <span>
          可领取
          {' '}
          <strong>{formatMicro(claimableWithdrawalAssetsMicro)}</strong>
        </span>
        <span>
          上次 NAV
          {' '}
          <strong>{formatShortDateTime(pool.lastFinalizedAt)}</strong>
        </span>
        <span className="bfi-status-message">{lastAction.label}</span>
      </section>

      <section className="bfi-campaign-row" aria-label="Featured pools">
        <button type="button" className="bfi-campaign-card is-featured">
          <span className="bfi-campaign-mark" />
          <span>
            <strong>
              {PLATFORM_NAME}
              {' '}
              板块流动性池已上线
            </strong>
            <small>
              为预测市场冷启动打造的板块资金池。奖励、做市收益和亏损都会反映到 LP 份额净值。
            </small>
          </span>
          <em>查看资金池</em>
        </button>
        <button type="button" className="bfi-campaign-card">
          <BotIcon />
        </button>
        <button type="button" className="bfi-campaign-card">
          <span className="bfi-letter-mark">B</span>
        </button>
        <button type="button" className="bfi-campaign-card">
          <SparklesIcon />
        </button>
      </section>

      <section className="bfi-pools-section" data-lab-grid>
        <div className="bfi-section-head">
          <h2>
            流动性池
            <span>
              （
              {filteredPools.length}
              ）
            </span>
          </h2>
          <div className="bfi-search-row">
            <label className="bfi-search-box" htmlFor="liquidity-pool-search">
              <Input
                id="liquidity-pool-search"
                className="bfi-search-input"
                placeholder="搜索..."
                value={poolSearch}
                onChange={event => setPoolSearch(event.target.value)}
              />
              <SearchIcon />
            </label>
            <Button className="bfi-filter-button" variant="outline">
              <SlidersHorizontalIcon />
              过滤器
            </Button>
          </div>
        </div>

        <div className={cn('bfi-pools-trade-grid', surface === 'pools' && 'is-list-only')}>
          <div className="bfi-table-card" data-lab-pools>
            <table className="bfi-pools-table">
              <thead>
                <tr>
                  <th>
                    <span className="bfi-chain-icon">◎</span>
                  </th>
                  <th>池名称</th>
                  <th>细节</th>
                  <th className="is-active-sort">TVL ↓</th>
                  <th>成交量 24h ↕</th>
                  <th>年化 ↕</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredPools.map((candidate) => {
                  const active = candidate.id === pool.id
                  const candidateState = calculateLabPoolState(candidate)
                  const candidateAprBps = estimatedAprBpsForPool(candidate)
                  const volumeMicro = candidateState.activeAllocatedAmountMicro * 18n
                  const tokenA = assetSymbol
                  const tokenB = `${categoryLabel(candidate.categorySlug)} LP`

                  return (
                    <tr key={candidate.id} className={cn(active && 'is-selected')}>
                      <td>
                        <span className="bfi-row-orb" />
                      </td>
                      <td>
                        {surface === 'pools'
                          ? (
                              <Link className="bfi-pool-name-button" href={swapHrefForPool(candidate)}>
                                <span className="bfi-token-pill is-green">{tokenA}</span>
                                <span className="bfi-token-pill is-purple">{tokenB}</span>
                              </Link>
                            )
                          : (
                              <button
                                type="button"
                                className="bfi-pool-name-button"
                                onClick={() => handleSelectPoolForAction(candidate, 'add')}
                              >
                                <span className="bfi-token-pill is-green">{tokenA}</span>
                                <span className="bfi-token-pill is-purple">{tokenB}</span>
                              </button>
                            )}
                      </td>
                      <td>
                        <span className="bfi-detail-pill">v1</span>
                        <span>{riskTierLabel(candidate.riskTier)}</span>
                        <span className="bfi-mini-orbs">
                          <span />
                          <span />
                          <span />
                        </span>
                      </td>
                      <td className="tabular-nums">{formatMicro(candidateState.navAmountMicro)}</td>
                      <td className="tabular-nums">{formatMicro(volumeMicro)}</td>
                      <td className="tabular-nums">
                        {formatBps(candidateAprBps)}
                        <span className="bfi-spark">✦</span>
                      </td>
                      <td>
                        {surface === 'pools'
                          ? (
                              <Link className="bfi-row-action" href={swapHrefForPool(candidate)}>存入</Link>
                            )
                          : (
                              <button
                                type="button"
                                className="bfi-row-action"
                                onClick={() => {
                                  handleSelectPoolForAction(candidate, 'add')
                                }}
                              >
                                管理
                              </button>
                            )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {surface === 'full'
            ? (
                <aside className="bfi-quick-panel" data-lab-quick-ops>
                  <div className="bfi-panel-card bfi-quick-card">
                    <div className="bfi-panel-head">
                      <div>
                        <span className="bfi-quick-eyebrow">当前池子</span>
                        <h3>{poolDisplayName(pool)}</h3>
                      </div>
                      <span className="bal-badge">{assetSymbol}</span>
                    </div>

                    <div className="bal-segmented" role="group" data-lab-quick-operation-tabs>
                      <button
                        type="button"
                        onClick={() => setOperationMode('add')}
                        className={cn('bal-tab', operationMode === 'add' && 'is-active')}
                        data-quick-operation-mode="add"
                      >
                        存入
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperationMode('remove')}
                        className={cn('bal-tab', operationMode === 'remove' && 'is-active')}
                        data-quick-operation-mode="remove"
                      >
                        退出
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperationMode('manage')}
                        className={cn('bal-tab', operationMode === 'manage' && 'is-active')}
                        data-quick-operation-mode="manage"
                      >
                        管理
                      </button>
                    </div>

                    {operationMode === 'add'
                      ? (
                          <div className="bal-card-stack" data-lab-quick-operation>
                            <div className="bal-token-input">
                              <Label className="bal-token-label" htmlFor="quick-liquidity-deposit-amount">存入金额</Label>
                              <div className="bal-input-row">
                                <Input
                                  className="bal-amount-input"
                                  id="quick-liquidity-deposit-amount"
                                  inputMode="decimal"
                                  value={depositAmount}
                                  onChange={event => setDepositAmount(event.target.value)}
                                />
                                <span className="bal-token-pill">
                                  <span className="bal-mini-symbol bal-bg-idle">{assetSymbol.slice(0, 4)}</span>
                                  {assetSymbol}
                                </span>
                              </div>
                            </div>
                            <div className="bal-action-summary">
                              <InfoRow label="份额净值" value={formatSharePrice(poolState.sharePriceMicro)} />
                              <InfoRow
                                label="daily NAV 后 mint"
                                value={depositPreview ? `${formatMicroUnits(depositPreview.shareAmountMicro)} ${categoryLabel(pool.categorySlug)} LP` : '-'}
                              />
                            </div>
                            <Button
                              className="bal-button bal-button-primary"
                              onClick={handleDeposit}
                              disabled={isPending}
                            >
                              <ArrowDownToLineIcon />
                              {pendingAction === 'deposit' ? '存入中' : '存入'}
                            </Button>
                          </div>
                        )
                      : null}

                    {operationMode === 'remove'
                      ? (
                          <div className="bal-card-stack" data-lab-quick-operation>
                            <div className="bal-token-input">
                              <Label className="bal-token-label" htmlFor="quick-liquidity-withdraw-amount">退出份额</Label>
                              <div className="bal-input-row">
                                <Input
                                  className="bal-amount-input"
                                  id="quick-liquidity-withdraw-amount"
                                  inputMode="decimal"
                                  value={withdrawAmount}
                                  onChange={event => setWithdrawAmount(event.target.value)}
                                />
                                <span className="bal-token-pill">
                                  <span className="bal-mini-symbol bal-bg-bot">LP</span>
                                  LP
                                </span>
                              </div>
                            </div>
                            <div className="bal-action-summary">
                              <InfoRow
                                label="预估结算"
                                value={withdrawalAssetsPreviewMicro ? formatMicro(withdrawalAssetsPreviewMicro) : '-'}
                              />
                              <InfoRow
                                label="可请求份额"
                                value={formatMicroUnits(unlockedSharesMicro)}
                              />
                            </div>
                            <Button
                              className="bal-button bal-button-secondary"
                              variant="outline"
                              onClick={handleWithdraw}
                              disabled={isPending}
                            >
                              <ArrowUpFromLineIcon />
                              {pendingAction === 'withdraw' ? '退出中' : '退出'}
                            </Button>
                          </div>
                        )
                      : null}

                    {operationMode === 'manage'
                      ? (
                          <div className="bal-card-stack" data-lab-quick-operation>
                            <div className="bal-action-summary">
                              <InfoRow label="做市可用" value={formatMicro(poolState.availableBotCapacityMicro)} />
                              <InfoRow label="累计奖励" tone="good" value={formatMicro(pool.rewardsAccruedAmountMicro)} />
                              <InfoRow label="做市 PnL" tone={botPnlTone} value={formatMicro(pool.realizedPnlAmountMicro, { signed: true })} />
                            </div>
                            <Button className="bal-button bal-button-secondary" variant="outline" onClick={handleRewardAccrual} disabled={isPending}>
                              <SparklesIcon />
                              {pendingAction === 'reward' ? '计入中' : '计入奖励'}
                            </Button>
                          </div>
                        )
                      : null}
                  </div>
                </aside>
              )
            : null}
        </div>
      </section>

      {surface === 'full'
        ? (
            <section className="bfi-selected-pool" data-lab-main>
              <div className="bfi-section-head">
                <h2>{poolDisplayName(pool)}</h2>
                <span className={cn('bfi-status-pill', mode !== 'sample' && 'is-live')}>
                  {labModeLabel(mode)}
                </span>
              </div>

              <div className="bfi-selected-grid">
                <div className="bfi-selected-main">
                  <div className="bfi-stat-grid" data-lab-metrics>
                    <MetricCard icon={WalletIcon} label="资金池规模" sublabel="TVL" value={formatMicro(poolState.navAmountMicro)} />
                    <MetricCard icon={CoinsIcon} label="份额净值" sublabel="LP share NAV" value={formatSharePrice(poolState.sharePriceMicro)} />
                    <MetricCard icon={BotIcon} label="做市可用额度" sublabel="可分配给策略" value={formatMicro(poolState.availableBotCapacityMicro)} />
                    <MetricCard icon={ActivityIcon} label="我的流动性" sublabel="当前标记价值" value={formatMicro(poolState.userAssetsMicro)} />
                  </div>

                  <Card className="bal-card" data-lab-capital>
                    <CardHeader className="bal-card-header">
                      <CardTitle className="bal-card-title">
                        <GaugeIcon />
                        池子资金构成
                      </CardTitle>
                      <span className="bal-badge">
                        已使用
                        {' '}
                        {formatBps(poolState.utilizationBps)}
                      </span>
                    </CardHeader>
                    <CardContent className="bal-card-body bal-card-stack">
                      <CapitalCompositionBar
                        allocatedAmountMicro={poolState.activeAllocatedAmountMicro}
                        idleAmountMicro={poolState.idleAmountMicro}
                        navAmountMicro={poolState.navAmountMicro}
                        reservedAmountMicro={reservedAmountMicro}
                      />
                      <div className="bal-four-col">
                        <DataTile label="闲置缓冲" tone={idleBufferTone} value={formatMicro(poolState.idleBufferTargetMicro)} />
                        <DataTile label="排队退出" value={formatMicro(queuedWithdrawalAmountMicro)} />
                        <DataTile label="累计奖励" tone="good" value={formatMicro(pool.rewardsAccruedAmountMicro)} />
                        <DataTile label="做市 PnL" tone={botPnlTone} value={formatMicro(pool.realizedPnlAmountMicro, { signed: true })} />
                      </div>
                      <div className="bal-two-col">
                        <CapacityBar label="做市使用率" valueBps={poolState.utilizationBps} />
                        <CapacityBar label="我的占比" valueBps={poolState.userOwnershipBps} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <aside className="bfi-action-panel" data-lab-ops>
                  <div className="bfi-panel-card">
                    <div className="bfi-panel-head">
                      <h3>
                        {operationMode === 'add'
                          ? '存入流动性'
                          : operationMode === 'remove'
                            ? '退出流动性'
                            : '管理资金池'}
                      </h3>
                      <span className="bal-badge">{assetSymbol}</span>
                    </div>

                    <div className={lastActionClass}>{lastAction.label}</div>

                    <div className="bal-segmented" role="group" data-lab-operation-tabs>
                      <button
                        type="button"
                        onClick={() => setOperationMode('add')}
                        className={cn('bal-tab', operationMode === 'add' && 'is-active')}
                        data-operation-mode="add"
                      >
                        存入
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperationMode('remove')}
                        className={cn('bal-tab', operationMode === 'remove' && 'is-active')}
                        data-operation-mode="remove"
                      >
                        退出
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperationMode('manage')}
                        className={cn('bal-tab', operationMode === 'manage' && 'is-active')}
                        data-operation-mode="manage"
                      >
                        管理
                      </button>
                    </div>

                    {operationMode === 'add'
                      ? (
                          <div className="bal-card-stack" data-lab-operation>
                            <div className="bal-token-input">
                              <Label className="bal-token-label" htmlFor="liquidity-deposit-amount">存入金额</Label>
                              <div className="bal-input-row">
                                <Input
                                  className="bal-amount-input"
                                  id="liquidity-deposit-amount"
                                  inputMode="decimal"
                                  value={depositAmount}
                                  onChange={event => setDepositAmount(event.target.value)}
                                />
                                <span className="bal-token-pill">
                                  <span className="bal-mini-symbol bal-bg-idle">{assetSymbol.slice(0, 4)}</span>
                                  {assetSymbol}
                                </span>
                              </div>
                            </div>
                            <div className="bal-action-summary">
                              <InfoRow label="当前份额净值" value={formatSharePrice(poolState.sharePriceMicro)} />
                              <InfoRow
                                label="daily NAV 后 mint"
                                value={depositPreview ? `${formatMicroUnits(depositPreview.shareAmountMicro)} ${categoryLabel(pool.categorySlug)} LP` : '-'}
                              />
                              <InfoRow label="预计年化" tone="good" value={formatBps(estimatedAprBps)} />
                              <InfoRow label="预计周奖励" tone="good" value={formatMicro(weeklyRewardEstimateMicro)} />
                            </div>
                            <Button
                              className="bal-button bal-button-primary"
                              onClick={handleDeposit}
                              disabled={isPending}
                            >
                              <ArrowDownToLineIcon />
                              {pendingAction === 'deposit' ? '存入中' : '存入流动性'}
                            </Button>
                          </div>
                        )
                      : null}

                    {operationMode === 'remove'
                      ? (
                          <div className="bal-card-stack" data-lab-operation>
                            <div className="bal-token-input">
                              <Label className="bal-token-label" htmlFor="liquidity-withdraw-amount">退出份额</Label>
                              <div className="bal-input-row">
                                <Input
                                  className="bal-amount-input"
                                  id="liquidity-withdraw-amount"
                                  inputMode="decimal"
                                  value={withdrawAmount}
                                  onChange={event => setWithdrawAmount(event.target.value)}
                                />
                                <span className="bal-token-pill">
                                  <span className="bal-mini-symbol bal-bg-bot">LP</span>
                                  LP
                                </span>
                              </div>
                            </div>
                            <div className="bal-action-summary">
                              <InfoRow
                                label="请求份额"
                                value={withdrawSharesPreview ? formatMicroUnits(withdrawSharesPreview) : '-'}
                              />
                              <InfoRow
                                label="预估结算"
                                value={withdrawalAssetsPreviewMicro ? formatMicro(withdrawalAssetsPreviewMicro) : '-'}
                              />
                              <InfoRow
                                label="可请求份额"
                                value={formatMicroUnits(unlockedSharesMicro)}
                              />
                              <InfoRow label="已锁定份额" value={formatMicroUnits(lockedSharesMicro)} />
                            </div>
                            <Button className="bal-button bal-button-secondary" variant="outline" onClick={handleWithdraw} disabled={isPending}>
                              <ArrowUpFromLineIcon />
                              {pendingAction === 'withdraw' ? '退出中' : '退出流动性'}
                            </Button>
                          </div>
                        )
                      : null}

                    {operationMode === 'manage'
                      ? (
                          <div className="bal-card-stack" data-lab-operation>
                            <div className="bal-field">
                              <Label className="bal-token-label" htmlFor="liquidity-reward-amount">奖励金额</Label>
                              <Input
                                className="bal-text-input"
                                id="liquidity-reward-amount"
                                inputMode="decimal"
                                value={rewardAmount}
                                onChange={event => setRewardAmount(event.target.value)}
                              />
                              <Button className="bal-button bal-button-secondary" variant="secondary" onClick={handleRewardAccrual} disabled={isPending}>
                                <SparklesIcon />
                                {pendingAction === 'reward' ? '计入中' : '计入奖励'}
                              </Button>
                            </div>

                            <div className="bal-field">
                              <Label className="bal-token-label" htmlFor="liquidity-bot-market">做市市场</Label>
                              <Input
                                className="bal-text-input"
                                id="liquidity-bot-market"
                                value={botMarketId}
                                onChange={event => setBotMarketId(event.target.value)}
                              />
                              <Label className="bal-token-label" htmlFor="liquidity-bot-allocation">分配额度</Label>
                              <Input
                                className="bal-text-input"
                                id="liquidity-bot-allocation"
                                inputMode="decimal"
                                value={botAllocationAmount}
                                onChange={event => setBotAllocationAmount(event.target.value)}
                              />
                              <Button className="bal-button bal-button-secondary" variant="outline" onClick={handleBotAllocation} disabled={isPending}>
                                <BotIcon />
                                {pendingAction === 'allocation' ? '分配中' : '设置额度'}
                              </Button>
                            </div>

                            <div className="bal-field">
                              <Label className="bal-token-label" htmlFor="liquidity-bot-pnl">做市 PnL 金额</Label>
                              <Input
                                className="bal-text-input"
                                id="liquidity-bot-pnl"
                                inputMode="decimal"
                                value={botPnlAmount}
                                onChange={event => setBotPnlAmount(event.target.value)}
                              />
                              <Button className="bal-button bal-button-secondary" variant="outline" onClick={handleBotSettlement} disabled={isPending}>
                                <AlertTriangleIcon />
                                {pendingAction === 'settle' ? '结算中' : '结算 PnL'}
                              </Button>
                            </div>
                          </div>
                        )
                      : null}
                  </div>
                </aside>
              </div>

              <div className="bfi-lower-grid">
                <Card className="bal-card" data-lab-withdrawals>
                  <CardHeader className="bal-card-header">
                    <CardTitle className="bal-card-title">
                      <ListChecksIcon />
                      退出申请
                    </CardTitle>
                    <span className={cn('bal-badge', claimableWithdrawalCount > 0 && 'is-blue')}>
                      {claimableWithdrawalCount}
                      {' '}
                      可领取
                    </span>
                  </CardHeader>
                  <CardContent className="bal-card-body bal-card-stack">
                    {poolWithdrawalRequests.length === 0
                      ? (
                          <div className="bal-empty">
                            <ListChecksIcon />
                            <p>这个资金池暂无退出申请。</p>
                          </div>
                        )
                      : poolWithdrawalRequests.map((request) => {
                          const claimableAssetsMicro = BigInt(request.claimableAssetsMicro ?? request.immediateAmountMicro)
                          const remainingSharesMicro = BigInt(request.remainingSharesMicro ?? request.sharesToBurnMicro)
                          const isClaimable = request.status !== 'completed'
                            && request.status !== 'cancelled'
                            && claimableAssetsMicro > 0n
                          const requestTone = statusTone(request.status)

                          return (
                            <div key={request.id} className="bal-withdrawal-row">
                              <div className="bal-withdrawal-head">
                                <div className="bal-truncate">
                                  <div className="bal-pool-name tabular-nums">
                                    {formatMicro(BigInt(request.assetsAmountMicro))}
                                  </div>
                                  <div className="bal-pool-meta">{formatDateTime(request.requestedAt)}</div>
                                </div>
                                <span
                                  className={cn(
                                    'bal-badge',
                                    requestTone === 'default' && 'is-blue',
                                    requestTone === 'secondary' && 'is-green',
                                  )}
                                >
                                  {withdrawalStatusLabel(request.status)}
                                </span>
                              </div>
                              <div className="bal-pool-mini-grid">
                                <DataTile label="可领取金额" value={formatMicro(claimableAssetsMicro)} />
                                <DataTile label="剩余排队份额" value={formatMicroUnits(remainingSharesMicro)} />
                              </div>
                              <InfoRow label="结算 epoch" value={formatDateTime(request.claimableAt)} />
                              <Button
                                className="bal-button bal-button-secondary"
                                variant="outline"
                                size="sm"
                                disabled={isPending || !isClaimable}
                                onClick={() => {
                                  void handleClaimWithdrawal(request)
                                }}
                              >
                                {pendingAction === 'claim' ? '领取中' : '领取'}
                              </Button>
                            </div>
                          )
                        })}
                  </CardContent>
                </Card>

                <Card className="bal-card" data-lab-allocations>
                  <CardHeader className="bal-card-header">
                    <CardTitle className="bal-card-title">
                      <ShieldCheckIcon />
                      风险与做市分配
                    </CardTitle>
                    <span className="bal-badge">{pool.activeStrategyAllocations.length}</span>
                  </CardHeader>
                  <CardContent className="bal-card-body bal-card-stack">
                    <InfoRow label="我的本金" value={formatMicro(pool.userPrincipalAmountMicro)} />
                    <InfoRow label="我的池子份额" value={formatMicroUnits(pool.userSharesMicro)} />
                    <InfoRow label="我的 PnL" tone={pnlTone} value={formatMicro(poolState.userPnlMicro, { signed: true })} />
                    <InfoRow label="单市场上限" value={formatMicro(poolState.maxSingleMarketAllocationMicro)} />
                    <InfoRow label="单结果上限" value={formatMicro(poolState.maxSingleOutcomeExposureMicro)} />
                    {pool.activeStrategyAllocations.map(allocation => (
                      <div key={allocation.marketConditionId} className="bal-allocation-row">
                        <div className="bal-allocation-head">
                          <div className="bal-truncate">
                            <div className="bal-pool-name">{allocation.marketSlug ?? allocation.marketConditionId}</div>
                            <div className="bal-pool-meta">{allocation.marketConditionId}</div>
                          </div>
                          <span className="bal-badge">
                            {formatBps(calculateBpsFromAmount(allocation.allocatedAmountMicro, poolState.navAmountMicro))}
                          </span>
                        </div>
                        <div className="bal-pool-mini-grid">
                          <DataTile label="已分配" value={formatMicro(allocation.allocatedAmountMicro)} />
                          <DataTile label="已使用" value={formatMicro(allocation.usedAmountMicro)} />
                          <DataTile label="风险敞口" value={formatMicro(allocation.currentExposureAmountMicro)} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </section>
          )
        : null}
    </main>
  )
}
