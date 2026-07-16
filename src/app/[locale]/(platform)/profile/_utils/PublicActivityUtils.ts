import type { ActivitySort, ActivityTypeFilter, ActivityVariant } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import type { ActivityOrder } from '@/types'
import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CircleXIcon,
  MergeIcon,
  UnfoldHorizontalIcon,
} from 'lucide-react'
import { MICRO_UNIT } from '@/lib/constants'
import { formatSharesLabel } from '@/lib/formatters'

export function resolveActivitySort(sortFilter: ActivitySort) {
  if (sortFilter === 'oldest') {
    return { sortBy: 'TIMESTAMP', sortDirection: 'ASC' as const }
  }
  if (sortFilter === 'value') {
    return { sortBy: 'CASH', sortDirection: 'DESC' as const }
  }
  if (sortFilter === 'shares') {
    return { sortBy: 'TOKENS', sortDirection: 'DESC' as const }
  }
  return { sortBy: 'TIMESTAMP', sortDirection: 'DESC' as const }
}

export function resolveActivityTypeParams(typeFilter: ActivityTypeFilter) {
  switch (typeFilter) {
    case 'trades':
      return { type: 'TRADE' }
    case 'buy':
      return { type: 'TRADE', side: 'BUY' }
    case 'merge':
      return { type: 'MERGE' }
    case 'redeem':
      return { type: 'REDEEM' }
    default:
      return {}
  }
}

function formatShares(amount: string | number | undefined) {
  if (amount == null) {
    return null
  }
  const numeric = Number(amount) / MICRO_UNIT
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }
  const useExtraPrecision = Math.abs(numeric) < 0.01
  const formatted = formatSharesLabel(numeric, {
    minimumFractionDigits: useExtraPrecision ? 4 : 0,
    maximumFractionDigits: useExtraPrecision ? 4 : 2,
  })
  return `${formatted} ${numeric === 1 ? 'share' : 'shares'}`
}

export function formatActivityShares(activity: ActivityOrder) {
  const variant = resolveVariant(activity)
  if (variant === 'redeem') {
    return null
  }
  if (variant === 'loss') {
    return '0.0 shares'
  }
  const amount = variant === 'split'
    ? Number(activity.amount) / 2
    : activity.amount
  return formatShares(amount)
}

export function formatPriceCents(price?: string | number) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return `${Math.round(numeric * 100)}¢`
}

export function resolveVariant(activity: ActivityOrder): ActivityVariant {
  const type = activity.type?.toLowerCase()
  if (type === 'loss') {
    return 'loss'
  }
  if (type === 'split') {
    return 'split'
  }
  if (type === 'merge' || type === 'merged') {
    return 'merge'
  }
  if (type === 'redeem' || type === 'redeemed' || type === 'redemption') {
    return 'redeem'
  }
  if (type === 'conversion' || type === 'convert' || type === 'converted') {
    return 'convert'
  }
  if (type === 'deposit' || type === 'deposit_funds') {
    return 'deposit'
  }
  if (type === 'withdraw' || type === 'withdraw_funds') {
    return 'withdraw'
  }
  if (type === 'sell') {
    return 'sell'
  }
  if (type === 'buy') {
    return 'buy'
  }
  if (activity.side === 'sell') {
    return 'sell'
  }
  if (activity.side === 'buy') {
    return 'buy'
  }
  return 'trade'
}

export function activityIcon(variant: ActivityVariant) {
  switch (variant) {
    case 'split':
      return { Icon: UnfoldHorizontalIcon, label: 'Split', className: '' }
    case 'merge':
      return { Icon: MergeIcon, label: 'Merged', className: 'rotate-90' }
    case 'redeem':
      return { Icon: CircleCheckIcon, label: 'Redeem', className: 'text-yes' }
    case 'loss':
      return { Icon: CircleXIcon, label: 'Loss', className: 'text-no' }
    case 'convert':
      return { Icon: CircleCheckIcon, label: 'Convert', className: 'text-yes' }
    case 'deposit':
      return { Icon: ArrowDownToLineIcon, label: 'Deposited', className: '' }
    case 'withdraw':
      return { Icon: ArrowUpToLineIcon, label: 'Withdrew', className: '' }
    case 'sell':
      return { Icon: CircleMinusIcon, label: 'Sold', className: '' }
    case 'buy':
      return { Icon: CirclePlusIcon, label: 'Bought', className: '' }
    default:
      return { Icon: CirclePlusIcon, label: 'Trade', className: '' }
  }
}

function formatCsvNumber(value: number) {
  if (!Number.isFinite(value)) {
    return ''
  }
  return value.toFixed(6).replace(/\.?0+$/, '')
}

function formatCsvValue(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function toNumeric(value: string | number | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function getActivityTimestampMs(activity: ActivityOrder) {
  const parsed = Date.parse(activity.created_at)
  return Number.isFinite(parsed) ? parsed : 0
}

export function matchesTypeFilter(activity: ActivityOrder, typeFilter: ActivityTypeFilter) {
  if (typeFilter === 'all') {
    return true
  }

  const variant = resolveVariant(activity)

  switch (typeFilter) {
    case 'trades':
      return variant === 'buy' || variant === 'sell' || variant === 'trade'
    case 'buy':
      return variant === 'buy'
    case 'merge':
      return variant === 'merge'
    case 'redeem':
      return variant === 'redeem' || variant === 'loss'
    default:
      return true
  }
}

function buildRedeemSettlementKey(activity: ActivityOrder) {
  const txHash = activity.tx_hash?.trim().toLowerCase()
  const marketKey = activity.market.condition_id?.trim().toLowerCase()
    || activity.market.slug?.trim().toLowerCase()
  const timestamp = activity.created_at?.trim()

  if (!txHash || !marketKey || !timestamp) {
    return null
  }

  return `${txHash}:${marketKey}:${timestamp}`
}

function hasDistinctRedeemOutcomes(activities: ActivityOrder[]) {
  const outcomes = new Set(
    activities.map((activity) => {
      const outcomeText = activity.outcome?.text?.trim().toLowerCase() || ''
      return `${activity.outcome?.index ?? ''}:${outcomeText}`
    }),
  )
  return outcomes.size === activities.length
}

function hasEquivalentRedeemAmounts(activities: ActivityOrder[]) {
  const [first] = activities
  if (!first) {
    return false
  }

  const firstAmount = Math.abs(toNumeric(first.amount))
  const firstValue = Math.abs(toNumeric(first.total_value))
  return activities.every((activity) => {
    const amount = Math.abs(toNumeric(activity.amount))
    const value = Math.abs(toNumeric(activity.total_value))
    return amount > 0
      && value > 0
      && Math.abs(amount - firstAmount) < 1
      && Math.abs(value - firstValue) < 1
  })
}

function buildSettlementActivity(
  activity: ActivityOrder,
  overrides: {
    id: string
    type: 'redeem' | 'loss'
    amount: string
    totalValue: number
  },
): ActivityOrder {
  return {
    ...activity,
    id: overrides.id,
    type: overrides.type,
    amount: overrides.amount,
    total_value: overrides.totalValue,
    outcome: {
      index: 0,
      text: 'Outcome',
    },
  }
}

function normalizeRedeemSettlementGroup(key: string, activities: ActivityOrder[]) {
  if (activities.length !== 2 || !hasDistinctRedeemOutcomes(activities) || !hasEquivalentRedeemAmounts(activities)) {
    return activities
  }

  const [base] = activities
  if (!base) {
    return activities
  }

  const amount = String(Math.max(...activities.map(activity => Math.abs(toNumeric(activity.amount)))))
  const totalValue = Math.max(...activities.map(activity => Math.abs(toNumeric(activity.total_value))))

  return [
    buildSettlementActivity(base, {
      id: `${key}:loss`,
      type: 'loss',
      amount: '0',
      totalValue: 0,
    }),
    buildSettlementActivity(base, {
      id: `${key}:redeem`,
      type: 'redeem',
      amount,
      totalValue,
    }),
  ]
}

export function normalizeActivityHistoryDisplay(activities: ActivityOrder[]) {
  const redeemGroups = new Map<string, ActivityOrder[]>()
  const seenActivityIds = new Set<string>()
  const uniqueActivities: ActivityOrder[] = []

  for (const activity of activities) {
    if (seenActivityIds.has(activity.id)) {
      continue
    }

    seenActivityIds.add(activity.id)
    uniqueActivities.push(activity)

    if (resolveVariant(activity) !== 'redeem') {
      continue
    }

    const key = buildRedeemSettlementKey(activity)
    if (!key) {
      continue
    }

    const group = redeemGroups.get(key)
    if (group) {
      group.push(activity)
    }
    else {
      redeemGroups.set(key, [activity])
    }
  }

  const processedKeys = new Set<string>()
  const normalized: ActivityOrder[] = []

  for (const activity of uniqueActivities) {
    const key = resolveVariant(activity) === 'redeem'
      ? buildRedeemSettlementKey(activity)
      : null

    if (!key) {
      normalized.push(activity)
      continue
    }

    const group = redeemGroups.get(key)
    if (!group || group.length === 1) {
      normalized.push(activity)
      continue
    }

    if (processedKeys.has(key)) {
      continue
    }

    processedKeys.add(key)
    normalized.push(...normalizeRedeemSettlementGroup(key, group))
  }

  return normalized
}

export function matchesSearchQuery(activity: ActivityOrder, searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase()
  if (!trimmed) {
    return true
  }

  const marketTitle = activity.market.title?.toLowerCase() ?? ''
  const outcomeText = activity.outcome?.text?.toLowerCase() ?? ''
  const txHash = activity.tx_hash?.toLowerCase() ?? ''
  return marketTitle.includes(trimmed) || outcomeText.includes(trimmed) || txHash.includes(trimmed)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function formatExportFilename(siteName: string, date: Date) {
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? 'Sun'
  const month = MONTH_LABELS[date.getMonth()] ?? 'Jan'
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  const rawOffsetMinutes = date.getTimezoneOffset()
  const offsetMinutes = Math.abs(rawOffsetMinutes)
  const offsetHours = String(Math.floor(offsetMinutes / 60)).padStart(2, '0')
  const offsetRemainder = String(offsetMinutes % 60).padStart(2, '0')
  const offsetSign = rawOffsetMinutes <= 0 ? '+' : '-'
  return `${siteName}_Transaction_History_${weekday}_${month}_${day}_${year}_${hour}_${minute}_${second}_GMT_${offsetSign}${offsetHours}${offsetRemainder}.csv`
}

export function buildActivityCsv(activities: ActivityOrder[], siteName: string) {
  const headers = [
    'marketName',
    'action',
    'usdcAmount',
    'tokenAmount',
    'tokenName',
    'timestamp',
    'hash',
  ]

  const rows = activities.map((activity) => {
    const variant = resolveVariant(activity)
    const action = variant.charAt(0).toUpperCase() + variant.slice(1)
    const marketName = variant === 'deposit'
      ? 'Deposited funds'
      : variant === 'withdraw'
        ? 'Withdrew funds'
        : activity.market.title
    const usdcAmount = formatCsvNumber(Math.abs(Number(activity.total_value)) / MICRO_UNIT)
    const tokenAmountValue = variant === 'split'
      ? Math.abs(Number(activity.amount)) / 2
      : Math.abs(Number(activity.amount))
    const tokenAmount = (variant === 'deposit' || variant === 'withdraw' || variant === 'redeem')
      ? ''
      : formatCsvNumber(tokenAmountValue / MICRO_UNIT)
    const tokenName = (variant === 'buy' || variant === 'sell' || variant === 'trade')
      ? (activity.outcome?.text ?? '')
      : ''
    const timestampMs = activity.created_at ? new Date(activity.created_at).getTime() : Number.NaN
    const timestamp = Number.isFinite(timestampMs)
      ? Math.floor(timestampMs / 1000).toString()
      : ''
    const hash = activity.tx_hash ?? ''

    return [marketName, action, usdcAmount, tokenAmount, tokenName, timestamp, hash]
  })

  const csvContent = [
    headers.map(formatCsvValue).join(','),
    ...rows.map(row => row.map(formatCsvValue).join(',')),
  ].join('\n')

  return {
    filename: formatExportFilename(siteName, new Date()),
    csvContent,
  }
}
