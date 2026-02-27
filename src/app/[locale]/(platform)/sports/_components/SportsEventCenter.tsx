'use client'

import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import type { SportsGamesMarketType } from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import type { SportsRedeemModalGroup, SportsRedeemModalSection } from '@/app/[locale]/(platform)/sports/_components/SportsRedeemModal'
import type { OddsFormat } from '@/lib/odds-format'
import type { UserPosition } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronLeftIcon, ShareIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import {
  groupButtonsByMarketType,
  resolveButtonDepthStyle,
  resolveButtonStyle,
  resolveDefaultConditionId,
  resolveSelectedButton,
  resolveSelectedMarket,
  resolveSelectedOutcome,
  resolveStableSpreadPrimaryOutcomeIndex,
  SportsGameDetailsPanel,
  SportsGameGraph,

  SportsOrderPanelMarketInfo,
} from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import SportsLivestreamFloatingPlayer
  from '@/app/[locale]/(platform)/sports/_components/SportsLivestreamFloatingPlayer'
import SportsRedeemModal from '@/app/[locale]/(platform)/sports/_components/SportsRedeemModal'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { Link } from '@/i18n/navigation'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserPositionsForMarket } from '@/lib/data-api/user'
import { formatVolume } from '@/lib/formatters'
import { formatOddsFromCents, ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useSportsLivestream } from '@/stores/useSportsLivestream'
import { useUser } from '@/stores/useUser'

type DetailsTab = 'orderBook' | 'graph' | 'about'
type EventSectionKey = Extract<SportsGamesMarketType, 'moneyline' | 'spread' | 'total' | 'btts'>

interface SportsEventCenterProps {
  card: SportsGamesCard
  sportSlug: string
  sportLabel: string
  initialMarketSlug?: string | null
}

const SECTION_ORDER: Array<{ key: EventSectionKey, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
  { key: 'btts', label: 'Both Teams to Score?' },
]

const headerIconButtonClass = `
  size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors
  hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9
`
const SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY = 'sports:event:odds-format'

function resolvePositionShares(position: UserPosition) {
  const totalShares = typeof position.total_shares === 'number' ? position.total_shares : Number(position.size ?? 0)
  return Number.isFinite(totalShares) ? totalShares : 0
}

function resolveOutcomeIndexFromPosition(position: UserPosition) {
  if (position.outcome_index === OUTCOME_INDEX.YES || position.outcome_index === OUTCOME_INDEX.NO) {
    return position.outcome_index
  }

  const normalizedOutcome = position.outcome_text?.trim().toLowerCase()
  if (normalizedOutcome === 'no') {
    return OUTCOME_INDEX.NO
  }
  if (normalizedOutcome === 'yes') {
    return OUTCOME_INDEX.YES
  }
  return null
}

function resolveIndexSetFromOutcomeIndex(outcomeIndex: number | null | undefined) {
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 1
  }
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 2
  }
  return null
}

function resolveTeamShortLabel(team: SportsGamesCard['teams'][number] | null | undefined) {
  const abbreviation = team?.abbreviation?.trim()
  if (abbreviation) {
    return abbreviation.toUpperCase()
  }

  const name = team?.name?.trim()
  if (!name) {
    return '—'
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)

  return initials || name.slice(0, 3).toUpperCase()
}

function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return null
  }

  const team1 = Number.parseInt(match[1] ?? '', 10)
  const team2 = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
    return null
  }

  return { team1, team2 }
}

function normalizeComparableToken(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
    ?? ''
}

function resolveTeamByTone(card: SportsGamesCard, tone: SportsGamesButton['tone']) {
  if (tone === 'team1') {
    return card.teams[0] ?? null
  }
  if (tone === 'team2') {
    return card.teams[1] ?? null
  }
  return null
}

function resolveRedeemOptionLabel(
  card: SportsGamesCard,
  market: SportsGamesCard['detailMarkets'][number],
  button: SportsGamesButton,
) {
  const rawLabel = button.label?.trim() ?? ''
  const team = resolveTeamByTone(card, button.tone)

  if (team?.name) {
    const firstToken = rawLabel.split(/\s+/)[0] ?? ''
    const normalizedFirstToken = normalizeComparableToken(firstToken)
    const normalizedTeamAbbreviation = normalizeComparableToken(team.abbreviation)
    const normalizedTeamName = normalizeComparableToken(team.name)

    if (normalizedFirstToken && (
      (normalizedTeamAbbreviation && normalizedFirstToken === normalizedTeamAbbreviation)
      || (normalizedTeamName && normalizedTeamName.startsWith(normalizedFirstToken))
    )) {
      return `${team.name}${rawLabel.slice(firstToken.length)}`
    }

    return team.name
  }

  if (button.tone === 'draw') {
    return 'Draw'
  }

  if (button.tone === 'over') {
    return rawLabel || 'Over'
  }

  if (button.tone === 'under') {
    return rawLabel || 'Under'
  }

  return market.sports_group_item_title?.trim()
    || market.short_title?.trim()
    || market.title
    || rawLabel
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  let normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (!normalized.startsWith('#')) {
    normalized = `#${normalized}`
  }

  if (/^#[0-9A-F]{3}$/i.test(normalized) || /^#[0-9A-F]{6}$/i.test(normalized)) {
    return normalized
  }

  return null
}

function resolveHexToRgbComponents(value: string) {
  const hex = value.replace('#', '')
  const expandedHex = hex.length === 3
    ? hex.split('').map(char => `${char}${char}`).join('')
    : hex

  const red = Number.parseInt(expandedHex.slice(0, 2), 16)
  const green = Number.parseInt(expandedHex.slice(2, 4), 16)
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16)
  if ([red, green, blue].some(component => Number.isNaN(component))) {
    return null
  }

  return `${red} ${green} ${blue}`
}

function resolveRedeemTagAccent(
  button: SportsGamesButton | null,
  outcomeIndex: number | null,
) {
  const normalizedTeamColor = normalizeHexColor(button?.color)
  if (
    button
    && (button.tone === 'team1' || button.tone === 'team2')
    && normalizedTeamColor
  ) {
    const rgbComponents = resolveHexToRgbComponents(normalizedTeamColor)
    const readableTeamColor = ensureReadableTextColorOnDark(normalizedTeamColor)
    return {
      badgeClassName: '',
      badgeStyle: {
        color: readableTeamColor ?? normalizedTeamColor,
        backgroundColor: rgbComponents ? `rgb(${rgbComponents} / 0.10)` : undefined,
      } as const,
    }
  }

  if ((button && button.tone === 'over') || outcomeIndex === OUTCOME_INDEX.YES) {
    return {
      badgeClassName: 'bg-yes/10 text-yes',
      badgeStyle: undefined,
    }
  }

  if ((button && button.tone === 'under') || outcomeIndex === OUTCOME_INDEX.NO) {
    return {
      badgeClassName: 'bg-no/10 text-no',
      badgeStyle: undefined,
    }
  }

  return {
    badgeClassName: 'bg-muted/60 text-muted-foreground',
    badgeStyle: undefined,
  }
}

function SportsEventShareButton({ event }: { event: SportsGamesCard['event'] }) {
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const [shareSuccess, setShareSuccess] = useState(false)
  const debugPayload = useMemo(() => {
    return {
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
      },
      markets: (event.markets ?? []).map(market => ({
        slug: market.slug,
        condition_id: market.condition_id,
        question_id: market.question_id,
        metadata_hash: market.condition?.metadata_hash ?? null,
        short_title: market.short_title ?? null,
        title: market.title,
        outcomes: market.outcomes.map(outcome => ({
          outcome_index: outcome.outcome_index,
          outcome_text: outcome.outcome_text,
          token_id: outcome.token_id,
        })),
      })),
    }
  }, [event.id, event.markets, event.slug, event.title])

  const handleDebugCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
    }
    catch {
      // noop
    }
  }, [debugPayload])

  const maybeHandleDebugCopy = useCallback((event: React.MouseEvent) => {
    if (!event.altKey) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    void handleDebugCopy()
    return true
  }, [handleDebugCopy])

  async function handleShare() {
    try {
      const url = new URL(window.location.href)
      if (affiliateCode) {
        url.searchParams.set('r', affiliateCode)
      }
      await navigator.clipboard.writeText(url.toString())
      setShareSuccess(true)
      window.setTimeout(() => setShareSuccess(false), 2000)
    }
    catch {
      // noop
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(headerIconButtonClass, 'size-auto p-0')}
      aria-label="Copy event link"
      onClick={(event) => {
        if (maybeHandleDebugCopy(event)) {
          return
        }
        void handleShare()
      }}
    >
      {shareSuccess
        ? <CheckIcon className="size-4 text-primary" />
        : <ShareIcon className="size-4" />}
    </Button>
  )
}

function SportsEventLiveStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-red-500')}
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
        <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  )
}

function sortSectionButtons(sectionKey: EventSectionKey, buttons: SportsGamesButton[]) {
  if (sectionKey === 'spread') {
    const order: Record<SportsGamesButton['tone'], number> = {
      team1: 0,
      team2: 1,
      draw: 2,
      over: 3,
      under: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  if (sectionKey === 'total' || sectionKey === 'btts') {
    const order: Record<SportsGamesButton['tone'], number> = {
      over: 0,
      under: 1,
      team1: 2,
      team2: 3,
      draw: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  return buttons
}

export default function SportsEventCenter({
  card,
  sportSlug,
  sportLabel,
  initialMarketSlug = null,
}: SportsEventCenterProps) {
  const locale = useLocale()
  const site = useSiteIdentity()
  const isMobile = useIsMobile()
  const setOrderEvent = useOrder(state => state.setEvent)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderSide = useOrder(state => state.setSide)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const openLivestream = useSportsLivestream(state => state.openStream)
  const orderMarketConditionId = useOrder(state => state.market?.condition_id ?? null)
  const orderOutcomeIndex = useOrder(state => state.outcome?.outcome_index ?? null)
  const user = useUser()
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('price')
  const [hasLoadedOddsFormat, setHasLoadedOddsFormat] = useState(false)
  const [claimedConditionIds, setClaimedConditionIds] = useState<Record<string, true>>({})
  const [redeemSectionKey, setRedeemSectionKey] = useState<EventSectionKey | null>(null)
  const [redeemDefaultConditionId, setRedeemDefaultConditionId] = useState<string | null>(null)

  const ownerAddress = useMemo(() => {
    if (user?.proxy_wallet_address && user.proxy_wallet_status === 'deployed') {
      return user.proxy_wallet_address
    }
    return null
  }, [user?.proxy_wallet_address, user?.proxy_wallet_status])

  const { data: userPositions } = useQuery<UserPosition[]>({
    queryKey: ['sports-event-user-positions', ownerAddress, card.id],
    enabled: Boolean(ownerAddress),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchInterval: ownerAddress ? 15_000 : false,
    refetchIntervalInBackground: true,
    queryFn: ({ signal }) => fetchUserPositionsForMarket({
      pageParam: 0,
      userAddress: ownerAddress!,
      status: 'active',
      signal,
    }),
  })

  useEffect(() => {
    setClaimedConditionIds({})
    setRedeemSectionKey(null)
    setRedeemDefaultConditionId(null)
  }, [card.id])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedOddsFormat = window.localStorage.getItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY)
    const matchedOption = ODDS_FORMAT_OPTIONS.find(option => option.value === storedOddsFormat)
    if (matchedOption) {
      setOddsFormat(matchedOption.value)
    }
    setHasLoadedOddsFormat(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedOddsFormat || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY, oddsFormat)
  }, [hasLoadedOddsFormat, oddsFormat])

  const formatButtonOdds = useCallback((cents: number) => {
    if (oddsFormat === 'price') {
      return `${cents}¢`
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])

  const groupedButtons = useMemo(() => groupButtonsByMarketType(card.buttons), [card.buttons])
  const detailMarketByConditionId = useMemo(
    () => new Map(card.detailMarkets.map(market => [market.condition_id, market] as const)),
    [card.detailMarkets],
  )
  const buttonByConditionAndOutcome = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    card.buttons.forEach((button) => {
      map.set(`${button.conditionId}:${button.outcomeIndex}`, button)
    })
    return map
  }, [card.buttons])
  const firstButtonByConditionId = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    card.buttons.forEach((button) => {
      if (!map.has(button.conditionId)) {
        map.set(button.conditionId, button)
      }
    })
    return map
  }, [card.buttons])
  const availableSections = useMemo(
    () => SECTION_ORDER.filter(section => groupedButtons[section.key].length > 0),
    [groupedButtons],
  )
  const sectionResolvedByKey = useMemo<Record<EventSectionKey, boolean>>(() => {
    const resolved: Record<EventSectionKey, boolean> = {
      moneyline: false,
      spread: false,
      total: false,
      btts: false,
    }

    SECTION_ORDER.forEach((section) => {
      const conditionIds = Array.from(new Set(groupedButtons[section.key].map(button => button.conditionId)))
      if (conditionIds.length === 0) {
        return
      }

      resolved[section.key] = conditionIds.every((conditionId) => {
        const market = detailMarketByConditionId.get(conditionId)
        return Boolean(market?.is_resolved || market?.condition?.resolved)
      })
    })

    return resolved
  }, [detailMarketByConditionId, groupedButtons])

  const claimGroupsBySection = useMemo<Record<EventSectionKey, SportsRedeemModalGroup[]>>(() => {
    const bySection: Record<EventSectionKey, SportsRedeemModalGroup[]> = {
      moneyline: [],
      spread: [],
      total: [],
      btts: [],
    }

    if (!userPositions?.length) {
      return bySection
    }

    const bySectionCondition = new Map<string, {
      sectionKey: EventSectionKey
      group: SportsRedeemModalGroup & { _indexSetCollection: Set<number> }
    }>()

    userPositions.forEach((position) => {
      if (!position.redeemable) {
        return
      }

      const conditionId = position.market?.condition_id
      if (!conditionId || claimedConditionIds[conditionId]) {
        return
      }

      const market = detailMarketByConditionId.get(conditionId)
      const firstButton = firstButtonByConditionId.get(conditionId)
      if (!market || !firstButton) {
        return
      }

      const sectionKey = firstButton.marketType as EventSectionKey
      if (!SECTION_ORDER.some(section => section.key === sectionKey)) {
        return
      }

      const shares = resolvePositionShares(position)
      if (!(shares > 0)) {
        return
      }

      const key = `${sectionKey}:${conditionId}`
      let bucket = bySectionCondition.get(key)
      if (!bucket) {
        bucket = {
          sectionKey,
          group: {
            conditionId,
            title: resolveRedeemOptionLabel(card, market, firstButton),
            amount: 0,
            indexSets: [],
            positions: [],
            _indexSetCollection: new Set<number>(),
          },
        }
        bySectionCondition.set(key, bucket)
      }

      const outcomeIndex = resolveOutcomeIndexFromPosition(position)
      const indexSet = resolveIndexSetFromOutcomeIndex(outcomeIndex)
      if (indexSet) {
        bucket.group._indexSetCollection.add(indexSet)
      }

      const positionButton = (outcomeIndex === OUTCOME_INDEX.YES || outcomeIndex === OUTCOME_INDEX.NO)
        ? (buttonByConditionAndOutcome.get(`${conditionId}:${outcomeIndex}`) ?? firstButton)
        : firstButton
      const outcomeLabel = (outcomeIndex === OUTCOME_INDEX.YES || outcomeIndex === OUTCOME_INDEX.NO)
        ? (market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)?.outcome_text
          ?? position.outcome_text
          ?? `Outcome ${outcomeIndex + 1}`)
        : (position.outcome_text || 'Outcome')
      const preferredButton = [positionButton, firstButton].find((button) => {
        const normalizedLabel = button.label?.trim().toLowerCase()
        return Boolean(normalizedLabel) && normalizedLabel !== 'yes' && normalizedLabel !== 'no'
      })
      const preferredButtonLabel = preferredButton
        ? resolveRedeemOptionLabel(card, market, preferredButton)
        : null
      const fallbackButtonLabel = [positionButton.label?.trim(), firstButton.label?.trim()].find((label) => {
        const normalizedLabel = label?.toLowerCase()
        return Boolean(label) && normalizedLabel !== 'yes' && normalizedLabel !== 'no'
      })
      const positionOptionLabel = preferredButtonLabel
        || fallbackButtonLabel
        || market.sports_group_item_title?.trim()
        || market.short_title?.trim()
        || market.title
      const outcomeSideLabel = outcomeIndex === OUTCOME_INDEX.NO
        ? 'No'
        : outcomeIndex === OUTCOME_INDEX.YES
          ? 'Yes'
          : null
      const positionLabel = outcomeSideLabel
        ? `${positionOptionLabel || outcomeLabel} - ${outcomeSideLabel}`
        : outcomeLabel
      const tagAccent = resolveRedeemTagAccent(positionButton, outcomeIndex)

      bucket.group.positions.push({
        key: `${conditionId}-${outcomeLabel}-${bucket.group.positions.length}`,
        label: positionLabel,
        shares,
        value: shares,
        badgeClassName: tagAccent.badgeClassName,
        badgeStyle: tagAccent.badgeStyle,
      })
      bucket.group.amount += shares
    })

    bySectionCondition.forEach(({ sectionKey, group }) => {
      if (group._indexSetCollection.size === 0) {
        const market = detailMarketByConditionId.get(group.conditionId)
        const winningOutcome = market?.outcomes.find(outcome => outcome.is_winning_outcome)
        const fallbackIndexSet = resolveIndexSetFromOutcomeIndex(winningOutcome?.outcome_index)
        if (fallbackIndexSet) {
          group._indexSetCollection.add(fallbackIndexSet)
        }
      }

      if (group._indexSetCollection.size === 0 || !(group.amount > 0)) {
        return
      }

      bySection[sectionKey].push({
        conditionId: group.conditionId,
        title: group.title,
        amount: group.amount,
        indexSets: Array.from(group._indexSetCollection).sort((a, b) => a - b),
        positions: group.positions,
      })
    })

    SECTION_ORDER.forEach((section) => {
      bySection[section.key].sort((left, right) => right.amount - left.amount)
    })

    return bySection
  }, [buttonByConditionAndOutcome, card, claimedConditionIds, detailMarketByConditionId, firstButtonByConditionId, userPositions])

  const marketSlugToButtonKey = useMemo(() => {
    if (!initialMarketSlug) {
      return null
    }

    const matchedMarket = card.detailMarkets.find(market => market.slug === initialMarketSlug)
    if (!matchedMarket) {
      return null
    }

    const matchedButton = card.buttons.find(button => button.conditionId === matchedMarket.condition_id)
    return matchedButton?.key ?? null
  }, [card.buttons, card.detailMarkets, initialMarketSlug])

  const [selectedButtonBySection, setSelectedButtonBySection] = useState<Record<EventSectionKey, string | null>>({
    moneyline: null,
    spread: null,
    total: null,
    btts: null,
  })
  const [activeTradeButtonKey, setActiveTradeButtonKey] = useState<string | null>(null)
  const [openSectionKey, setOpenSectionKey] = useState<EventSectionKey | null>(null)
  const [tabBySection, setTabBySection] = useState<Record<EventSectionKey, DetailsTab>>({
    moneyline: 'orderBook',
    spread: 'orderBook',
    total: 'orderBook',
    btts: 'orderBook',
  })
  const previousCardIdRef = useRef<string | null>(null)

  useEffect(() => {
    const isNewCard = previousCardIdRef.current !== card.id
    previousCardIdRef.current = card.id

    const defaultSelectedBySection: Record<EventSectionKey, string | null> = {
      moneyline: null,
      spread: null,
      total: null,
      btts: null,
    }

    for (const section of SECTION_ORDER) {
      const firstButton = groupedButtons[section.key][0] ?? null
      defaultSelectedBySection[section.key] = firstButton?.key ?? null
    }

    if (marketSlugToButtonKey) {
      const marketButton = card.buttons.find(button => button.key === marketSlugToButtonKey)
      if (marketButton) {
        defaultSelectedBySection[marketButton.marketType as EventSectionKey] = marketButton.key
      }
    }

    setSelectedButtonBySection((current) => {
      if (isNewCard) {
        return defaultSelectedBySection
      }

      const next: Record<EventSectionKey, string | null> = {
        ...defaultSelectedBySection,
      }

      for (const section of SECTION_ORDER) {
        const currentButtonKey = current[section.key]
        if (!currentButtonKey) {
          continue
        }

        const stillExists = groupedButtons[section.key].some(button => button.key === currentButtonKey)
        if (stillExists) {
          next[section.key] = currentButtonKey
        }
      }

      return next
    })

    const defaultTradeButton = marketSlugToButtonKey
      ?? defaultSelectedBySection.moneyline
      ?? defaultSelectedBySection.spread
      ?? defaultSelectedBySection.total
      ?? defaultSelectedBySection.btts
      ?? resolveDefaultConditionId(card)

    setActiveTradeButtonKey((current) => {
      if (marketSlugToButtonKey) {
        const matchesMarketSlug = card.buttons.some(button => button.key === marketSlugToButtonKey)
        if (matchesMarketSlug) {
          return marketSlugToButtonKey
        }
      }

      if (!isNewCard && current) {
        const stillExists = card.buttons.some(button => button.key === current)
        if (stillExists) {
          return current
        }
      }

      return defaultTradeButton
    })

    setOpenSectionKey((current) => {
      if (isNewCard) {
        return null
      }
      if (current && groupedButtons[current].length > 0) {
        return current
      }
      return null
    })
  }, [card, card.id, card.buttons, groupedButtons, marketSlugToButtonKey])

  const moneylineButtonKey = selectedButtonBySection.moneyline ?? groupedButtons.moneyline[0]?.key ?? null
  const fallbackButtonFromOrderState = useMemo(() => {
    if (!orderMarketConditionId) {
      return null
    }

    if (orderOutcomeIndex === OUTCOME_INDEX.YES || orderOutcomeIndex === OUTCOME_INDEX.NO) {
      const exactButton = card.buttons.find(button =>
        button.conditionId === orderMarketConditionId && button.outcomeIndex === orderOutcomeIndex,
      )
      if (exactButton) {
        return exactButton.key
      }
    }

    const conditionButton = card.buttons.find(button => button.conditionId === orderMarketConditionId)
    return conditionButton?.key ?? null
  }, [card.buttons, orderMarketConditionId, orderOutcomeIndex])

  const activeTradeContext = useMemo(() => {
    const candidateKeys = [
      activeTradeButtonKey,
      fallbackButtonFromOrderState,
      openSectionKey ? selectedButtonBySection[openSectionKey] : null,
      moneylineButtonKey,
      selectedButtonBySection.spread,
      selectedButtonBySection.total,
      selectedButtonBySection.btts,
      resolveDefaultConditionId(card),
    ]
    const effectiveButtonKey = candidateKeys.find((buttonKey) => {
      if (!buttonKey) {
        return false
      }

      return card.buttons.some(button => button.key === buttonKey)
    }) ?? null
    if (!effectiveButtonKey) {
      return null
    }

    const button = resolveSelectedButton(card, effectiveButtonKey)
    if (!button) {
      return null
    }

    const market = resolveSelectedMarket(card, button.key)
    if (!market) {
      return null
    }

    const outcome = resolveSelectedOutcome(market, button)
    if (!outcome) {
      return null
    }

    return { button, market, outcome }
  }, [
    activeTradeButtonKey,
    card,
    fallbackButtonFromOrderState,
    moneylineButtonKey,
    openSectionKey,
    selectedButtonBySection,
  ])

  const activeTradeHeaderContext = useMemo(() => {
    if (!activeTradeContext) {
      return null
    }

    if (!orderMarketConditionId || orderMarketConditionId !== activeTradeContext.market.condition_id) {
      return activeTradeContext
    }

    if (orderOutcomeIndex == null) {
      return activeTradeContext
    }

    const matchedOutcome = activeTradeContext.market.outcomes.find(
      outcome => outcome.outcome_index === orderOutcomeIndex,
    ) ?? activeTradeContext.outcome

    const matchedButton = card.buttons.find(
      button => (
        button.conditionId === activeTradeContext.market.condition_id
        && button.outcomeIndex === orderOutcomeIndex
      ),
    ) ?? activeTradeContext.button

    return {
      ...activeTradeContext,
      button: matchedButton,
      outcome: matchedOutcome,
    }
  }, [activeTradeContext, card.buttons, orderMarketConditionId, orderOutcomeIndex])

  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(card, activeTradeContext.button.conditionId)
  }, [activeTradeContext, card])

  useEffect(() => {
    if (!activeTradeContext) {
      return
    }

    setOrderEvent(card.event)
    setOrderMarket(activeTradeContext.market)
    setOrderOutcome(activeTradeContext.outcome)
    setOrderSide(ORDER_SIDE.BUY)
  }, [activeTradeContext, card.event, setOrderEvent, setOrderMarket, setOrderOutcome, setOrderSide])

  const sectionVolumes = useMemo(() => {
    const byConditionId = new Map(card.detailMarkets.map(market => [market.condition_id, market] as const))
    const volumes: Record<EventSectionKey, number> = {
      moneyline: 0,
      spread: 0,
      total: 0,
      btts: 0,
    }

    for (const section of SECTION_ORDER) {
      const conditionIds = Array.from(new Set(groupedButtons[section.key].map(button => button.conditionId)))
      volumes[section.key] = conditionIds.reduce((sum, conditionId) => {
        const market = byConditionId.get(conditionId)
        return sum + (Number(market?.volume ?? 0) || 0)
      }, 0)
    }

    return volumes
  }, [card.detailMarkets, groupedButtons])

  const sectionConditionIdsByKey = useMemo<Record<EventSectionKey, Set<string>>>(() => {
    return {
      moneyline: new Set(groupedButtons.moneyline.map(button => button.conditionId)),
      spread: new Set(groupedButtons.spread.map(button => button.conditionId)),
      total: new Set(groupedButtons.total.map(button => button.conditionId)),
      btts: new Set(groupedButtons.btts.map(button => button.conditionId)),
    }
  }, [groupedButtons])

  function resolveSectionButtons(sectionKey: EventSectionKey) {
    const sectionButtons = groupedButtons[sectionKey]
    if (sectionButtons.length === 0) {
      return [] as SportsGamesButton[]
    }

    if (sectionKey === 'moneyline') {
      return sortSectionButtons(sectionKey, sectionButtons)
    }

    const byConditionId = new Map<string, SportsGamesButton[]>()
    sectionButtons.forEach((button) => {
      const existing = byConditionId.get(button.conditionId)
      if (existing) {
        existing.push(button)
      }
      else {
        byConditionId.set(button.conditionId, [button])
      }
    })

    const selectedButtonKey = selectedButtonBySection[sectionKey]
    const selectedButton = selectedButtonKey
      ? sectionButtons.find(button => button.key === selectedButtonKey) ?? null
      : null
    const activeConditionId = selectedButton?.conditionId ?? sectionButtons[0]?.conditionId
    const activeConditionButtons = activeConditionId ? (byConditionId.get(activeConditionId) ?? []) : []

    return sortSectionButtons(sectionKey, activeConditionButtons)
  }

  function updateSectionSelection(
    sectionKey: EventSectionKey,
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) {
    setSelectedButtonBySection((current) => {
      if (current[sectionKey] === buttonKey) {
        return current
      }
      return {
        ...current,
        [sectionKey]: buttonKey,
      }
    })

    setActiveTradeButtonKey(buttonKey)

    const panelMode = options?.panelMode ?? 'full'
    const shouldOpenMobileSheetOnly = isMobile && panelMode === 'full'

    if (shouldOpenMobileSheetOnly) {
      setIsMobileOrderPanelOpen(true)
    }

    if (panelMode === 'full' && !shouldOpenMobileSheetOnly) {
      setOpenSectionKey(sectionKey)
    }
  }

  const startDate = card.startTime ? new Date(card.startTime) : null
  const hasValidStartDate = Boolean(startDate && !Number.isNaN(startDate.getTime()))
  const timeLabel = hasValidStartDate
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(startDate as Date)
    : 'TBD'
  const dayLabel = hasValidStartDate
    ? new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(startDate as Date)
    : 'Date TBD'

  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const shortTeam1Label = resolveTeamShortLabel(team1)
  const shortTeam2Label = resolveTeamShortLabel(team2)
  const eventShortLabel = `${shortTeam1Label} vs. ${shortTeam2Label}`
  const eventTitle = team1 && team2
    ? `${team1.name} vs ${team2.name}`
    : card.title
  const hasLivestreamUrl = Boolean(card.event.livestream_url?.trim())
  const canWatchLivestream = hasLivestreamUrl && card.event.sports_ended !== true && card.event.sports_live !== false
  const showFinalScore = card.event.sports_ended === true
  const parsedFinalScore = parseSportsScore(card.event.sports_score)
  const team1Score = parsedFinalScore?.team1
  const team2Score = parsedFinalScore?.team2
  const team1Won = team1Score != null && team2Score != null && team1Score > team2Score
  const team2Won = team1Score != null && team2Score != null && team2Score > team1Score

  const moneylineSelectedButton = resolveSelectedButton(card, moneylineButtonKey)
  const graphConditionId = moneylineSelectedButton?.conditionId ?? null
  const allCardConditionIds = useMemo(
    () => new Set(card.detailMarkets.map(market => market.condition_id)),
    [card.detailMarkets],
  )
  const redeemSectionConfig = useMemo(
    () => (redeemSectionKey ? SECTION_ORDER.find(section => section.key === redeemSectionKey) ?? null : null),
    [redeemSectionKey],
  )
  const redeemModalSections = useMemo<SportsRedeemModalSection[]>(
    () =>
      SECTION_ORDER
        .map(section => ({
          key: section.key,
          label: section.label,
          groups: claimGroupsBySection[section.key],
        }))
        .filter(section => section.groups.length > 0),
    [claimGroupsBySection],
  )
  const handleOpenRedeemForCondition = useCallback((conditionId: string) => {
    const normalizedConditionId = conditionId.trim()
    if (!normalizedConditionId) {
      return
    }

    const matchedSection = SECTION_ORDER.find(section =>
      claimGroupsBySection[section.key].some(group => group.conditionId === normalizedConditionId),
    ) ?? SECTION_ORDER.find(section => sectionConditionIdsByKey[section.key].has(normalizedConditionId))
    ?? SECTION_ORDER.find(section => claimGroupsBySection[section.key].length > 0)
    ?? null

    if (!matchedSection) {
      return
    }

    setRedeemDefaultConditionId(normalizedConditionId)
    setRedeemSectionKey(matchedSection.key)
  }, [claimGroupsBySection, sectionConditionIdsByKey])

  return (
    <>
      <div className="
        min-[1200px]:grid min-[1200px]:h-full min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem] min-[1200px]:gap-6
      "
      >
        <section
          data-sports-scroll-pane="center"
          className="min-w-0 min-[1200px]:min-h-0 min-[1200px]:overflow-y-auto min-[1200px]:pr-1 lg:ml-4"
        >
          <div className="mb-4">
            <div className="relative mb-1 flex min-h-9 items-center justify-center">
              <Link
                href={`/sports/${sportSlug}/games`}
                aria-label="Back to games"
                className={cn(
                  headerIconButtonClass,
                  'absolute left-0 inline-flex size-8 items-center justify-center p-0 text-foreground md:size-9',
                )}
              >
                <ChevronLeftIcon className="size-4 text-foreground" />
              </Link>

              <div
                className="
                  flex min-w-0 items-center justify-center gap-1 px-14 text-center text-sm text-muted-foreground
                  sm:px-22
                "
              >
                <Link href="/sports/live" className="hover:text-foreground">
                  Sports
                </Link>
                <span className="opacity-60">·</span>
                <Link href={`/sports/${sportSlug}/games`} className="truncate hover:text-foreground">
                  {sportLabel}
                </Link>
              </div>

              <div className="absolute right-0 flex items-center gap-1 text-foreground">
                <EventBookmark event={card.event} />
                <SportsEventShareButton event={card.event} />
              </div>
            </div>

            <h1 className="text-center text-xl font-semibold text-foreground sm:text-2xl">
              {eventTitle}
            </h1>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/70" />
            <div className="pointer-events-none flex items-center gap-2 text-sm text-muted-foreground select-none">
              <SiteLogoIcon
                logoSvg={site.logoSvg}
                logoImageUrl={site.logoImageUrl}
                alt={`${site.name} logo`}
                className="
                  pointer-events-none size-4 text-current select-none
                  [&_svg]:size-4
                  [&_svg_*]:fill-current [&_svg_*]:stroke-current
                "
                imageClassName="pointer-events-none size-4 object-contain select-none"
                size={16}
              />
              <span className="font-medium select-none">{site.name}</span>
            </div>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          {canWatchLivestream && (
            <div className="mb-4 flex items-center justify-center">
              <button
                type="button"
                onClick={() => openLivestream({
                  url: card.event.livestream_url!,
                  title: card.event.title || card.title,
                })}
                className={`
                  inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/80 bg-background px-3
                  py-1.5 text-xs font-medium text-muted-foreground transition-colors
                  hover:bg-secondary/50 hover:text-foreground
                `}
              >
                <SportsEventLiveStatusIcon className="size-3.5" />
                <span>Watch Stream</span>
              </button>
            </div>
          )}

          <div className="mb-4 flex items-center justify-center gap-12 md:gap-14">
            <div className="flex w-20 flex-col items-center gap-2">
              <div className="pointer-events-none flex size-12 items-center justify-center select-none">
                {team1?.logoUrl
                  ? (
                      <Image
                        src={team1.logoUrl}
                        alt={`${team1.name} logo`}
                        width={48}
                        height={48}
                        sizes="48px"
                        draggable={false}
                        className="size-full object-contain object-center select-none"
                      />
                    )
                  : (
                      <div className="text-sm font-semibold text-muted-foreground">
                        {team1?.abbreviation ?? '—'}
                      </div>
                    )}
              </div>
              <span className="text-base font-semibold text-foreground uppercase">{team1?.abbreviation ?? '—'}</span>
            </div>

            {showFinalScore
              ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-3xl leading-none font-semibold tabular-nums">
                      <span
                        className={team1Won
                          ? 'text-foreground'
                          : team2Won
                            ? 'text-muted-foreground'
                            : 'text-foreground'}
                      >
                        {team1Score ?? '—'}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span
                        className={team2Won
                          ? 'text-foreground'
                          : team1Won
                            ? 'text-muted-foreground'
                            : 'text-foreground'}
                      >
                        {team2Score ?? '—'}
                      </span>
                    </div>
                    <span className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      FINAL
                    </span>
                  </div>
                )
              : (
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-foreground">{timeLabel}</span>
                    <span className="text-sm font-medium text-muted-foreground">{dayLabel}</span>
                  </div>
                )}

            <div className="flex w-20 flex-col items-center gap-2">
              <div className="pointer-events-none flex size-12 items-center justify-center select-none">
                {team2?.logoUrl
                  ? (
                      <Image
                        src={team2.logoUrl}
                        alt={`${team2.name} logo`}
                        width={48}
                        height={48}
                        sizes="48px"
                        draggable={false}
                        className="size-full object-contain object-center select-none"
                      />
                    )
                  : (
                      <div className="text-sm font-semibold text-muted-foreground">
                        {team2?.abbreviation ?? '—'}
                      </div>
                    )}
              </div>
              <span className="text-base font-semibold text-foreground uppercase">{team2?.abbreviation ?? '—'}</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-muted-foreground">
                {formatVolume(card.volume)}
                {' '}
                Vol.
              </span>
              <div className="pointer-events-none flex items-center gap-2 text-muted-foreground select-none">
                <SiteLogoIcon
                  logoSvg={site.logoSvg}
                  logoImageUrl={site.logoImageUrl}
                  alt={`${site.name} logo`}
                  className="
                    pointer-events-none size-4 text-current select-none
                    [&_svg]:size-4
                    [&_svg_*]:fill-current [&_svg_*]:stroke-current
                  "
                  imageClassName="pointer-events-none size-4 object-contain select-none"
                  size={16}
                />
                <span className="text-base font-semibold select-none">{site.name}</span>
              </div>
            </div>
            <SportsGameGraph
              card={card}
              selectedMarketType="moneyline"
              selectedConditionId={graphConditionId}
              defaultTimeRange="ALL"
              variant="sportsEventHero"
            />
          </div>

          <div className="mb-4 overflow-hidden rounded-xl border bg-card px-2.5">
            <SportsGameDetailsPanel
              card={card}
              activeDetailsTab="orderBook"
              selectedButtonKey={moneylineButtonKey}
              showBottomContent={false}
              defaultGraphTimeRange="ALL"
              allowedConditionIds={allCardConditionIds}
              positionsTitle="All Positions"
              showRedeemInPositions={card.event.sports_ended === true}
              onOpenRedeemForCondition={handleOpenRedeemForCondition}
              oddsFormat={oddsFormat}
              onChangeTab={() => {}}
              onSelectButton={(buttonKey) => {
                setActiveTradeButtonKey(buttonKey)
              }}
            />
          </div>

          <div className="space-y-4">
            {availableSections.map((section) => {
              const sectionButtons = resolveSectionButtons(section.key)
              if (sectionButtons.length === 0) {
                return null
              }

              const selectedButtonKey = selectedButtonBySection[section.key] ?? sectionButtons[0]?.key ?? null
              const isSectionOpen = openSectionKey === section.key
              const sectionConditionIds = sectionConditionIdsByKey[section.key]
              const activeTab = tabBySection[section.key] ?? 'orderBook'
              const selectedSectionButton = resolveSelectedButton(card, selectedButtonKey)
              const isSectionResolved = sectionResolvedByKey[section.key]
              const sectionClaimGroups = claimGroupsBySection[section.key]
              const shouldShowRedeemButton = isSectionResolved && sectionClaimGroups.length > 0
              const shouldUseClosedLinePickerSpacing = (
                !isSectionResolved
                && !isSectionOpen
                && (selectedSectionButton?.marketType === 'spread' || selectedSectionButton?.marketType === 'total')
              )
              const firstSectionButtonKey = sectionButtons[0]?.key ?? null
              function toggleSection() {
                setOpenSectionKey(current => current === section.key ? null : section.key)
              }

              function handleCardClick(event: React.MouseEvent<HTMLElement>) {
                const target = event.target as HTMLElement
                if (target.closest('[data-sports-card-control="true"]')) {
                  return
                }
                if (firstSectionButtonKey) {
                  updateSectionSelection(section.key, firstSectionButtonKey, { panelMode: 'preserve' })
                }
                toggleSection()
              }

              function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                const target = event.target as HTMLElement
                if (target.closest('[data-sports-card-control="true"]')) {
                  return
                }
                event.preventDefault()
                if (firstSectionButtonKey) {
                  updateSectionSelection(section.key, firstSectionButtonKey, { panelMode: 'preserve' })
                }
                toggleSection()
              }

              return (
                <article
                  key={`${card.id}-${section.key}`}
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <div
                    className={cn(
                      `
                        flex w-full cursor-pointer flex-col items-stretch gap-3 px-4 py-[18px] transition-colors
                        sm:flex-row sm:items-center
                      `,
                      'hover:bg-secondary/30',
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={handleCardClick}
                    onKeyDown={handleCardKeyDown}
                  >
                    <div
                      className={cn(
                        'min-w-0 text-left transition-colors hover:text-foreground/90',
                      )}
                    >
                      <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {formatVolume(sectionVolumes[section.key])}
                        {' '}
                        Vol.
                      </p>
                    </div>

                    {!isSectionResolved && (
                      <div
                        className={cn(
                          'grid min-w-0 flex-1 items-stretch gap-2',
                          'min-[1200px]:ml-auto min-[1200px]:w-[372px] min-[1200px]:flex-none',
                          sectionButtons.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
                          'min-[1200px]:grid-cols-3',
                        )}
                      >
                        {sectionButtons.map((button) => {
                          const isActive = activeTradeButtonKey === button.key
                          const hasTeamColor = isActive
                            && (button.tone === 'team1' || button.tone === 'team2')
                            && Boolean(button.color)
                          const isOverButton = isActive && button.tone === 'over'
                          const isUnderButton = isActive && button.tone === 'under'

                          return (
                            <div
                              key={`${section.key}-${button.key}`}
                              className={cn(
                                'relative min-w-0 overflow-hidden rounded-lg pb-1.25',
                              )}
                            >
                              <div
                                className={cn(
                                  'pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg',
                                  !hasTeamColor && !isOverButton && !isUnderButton && 'bg-border/70',
                                  isOverButton && 'bg-yes/70',
                                  isUnderButton && 'bg-no/70',
                                )}
                                style={hasTeamColor ? resolveButtonDepthStyle(button.color) : undefined}
                              />
                              <button
                                type="button"
                                data-sports-card-control="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  updateSectionSelection(section.key, button.key, { panelMode: 'full' })
                                }}
                                style={hasTeamColor ? resolveButtonStyle(button.color) : undefined}
                                className={cn(
                                  `
                                    relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg px-2
                                    text-xs font-semibold shadow-sm transition-transform duration-150 ease-out
                                    hover:translate-y-px
                                    active:translate-y-0.5
                                  `,
                                  !hasTeamColor && !isOverButton && !isUnderButton
                                  && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                  isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                  isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                                )}
                              >
                                {section.key === 'moneyline'
                                  ? (
                                      <>
                                        <span className="mr-1 uppercase opacity-80">{button.label}</span>
                                        <span className={cn(
                                          'text-sm leading-none tabular-nums transition-opacity',
                                          isActive ? 'text-foreground opacity-100' : 'opacity-45',
                                        )}
                                        >
                                          {formatButtonOdds(button.cents)}
                                        </span>
                                      </>
                                    )
                                  : (
                                      <span className="flex w-full items-center justify-between gap-1 px-1">
                                        <span className="min-w-0 truncate text-left uppercase opacity-80">
                                          {button.label}
                                        </span>
                                        <span className="shrink-0 text-sm leading-none tabular-nums">
                                          {formatButtonOdds(button.cents)}
                                        </span>
                                      </span>
                                    )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {shouldShowRedeemButton && (
                      <div
                        className="
                          min-w-0 flex-1
                          min-[1200px]:ml-auto min-[1200px]:w-[calc((372px-1rem)/3)] min-[1200px]:flex-none
                        "
                      >
                        <div className="relative min-w-0 overflow-hidden rounded-lg pb-1.25">
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg bg-primary" />
                          <button
                            type="button"
                            data-sports-card-control="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              const sectionDefaultConditionId = selectedSectionButton?.conditionId
                                ?? sectionClaimGroups[0]?.conditionId
                                ?? null
                              setRedeemDefaultConditionId(sectionDefaultConditionId)
                              setRedeemSectionKey(section.key)
                            }}
                            className={`
                              relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg bg-primary
                              px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-transform
                              duration-150 ease-out
                              hover:translate-y-px hover:bg-primary
                              active:translate-y-0.5
                            `}
                          >
                            Redeem
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      'bg-card px-2.5',
                      isSectionOpen
                        ? 'border-t pt-3'
                        : shouldUseClosedLinePickerSpacing
                          ? 'pt-3'
                          : 'pt-0',
                    )}
                  >
                    <SportsGameDetailsPanel
                      card={card}
                      activeDetailsTab={activeTab}
                      selectedButtonKey={selectedButtonKey}
                      showBottomContent={isSectionOpen}
                      defaultGraphTimeRange="ALL"
                      allowedConditionIds={sectionConditionIds}
                      showAboutTab
                      aboutEvent={card.event}
                      oddsFormat={oddsFormat}
                      onChangeTab={tab => setTabBySection(current => ({ ...current, [section.key]: tab }))}
                      onSelectButton={(buttonKey, options) => {
                        updateSectionSelection(section.key, buttonKey, options)
                      }}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside
          data-sports-scroll-pane="aside"
          className={`
            hidden gap-4
            min-[1200px]:sticky min-[1200px]:top-0 min-[1200px]:grid min-[1200px]:max-h-full min-[1200px]:self-start
            min-[1200px]:overflow-y-auto
          `}
        >
          {activeTradeContext
            ? (
                <div className="grid gap-6">
                  <EventOrderPanelForm
                    isMobile={false}
                    event={card.event}
                    oddsFormat={oddsFormat}
                    outcomeButtonStyleVariant="sports3d"
                    optimisticallyClaimedConditionIds={claimedConditionIds}
                    desktopMarketInfo={(
                      <SportsOrderPanelMarketInfo
                        card={card}
                        selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
                        selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
                        marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
                      />
                    )}
                    primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
                  />
                  <EventOrderPanelTermsDisclaimer />
                </div>
              )
            : (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Select a market to trade.
                </div>
              )}
        </aside>
      </div>

      {isMobile && activeTradeContext && (
        <EventOrderPanelMobile
          event={card.event}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant="sports3d"
          optimisticallyClaimedConditionIds={claimedConditionIds}
          mobileMarketInfo={(
            <SportsOrderPanelMarketInfo
              card={card}
              selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
              selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
              marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
            />
          )}
          primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
        />
      )}

      {redeemSectionConfig && (
        <SportsRedeemModal
          open={Boolean(redeemSectionConfig)}
          onOpenChange={(open) => {
            if (!open) {
              setRedeemSectionKey(null)
              setRedeemDefaultConditionId(null)
            }
          }}
          title="Cash out"
          subtitle={eventShortLabel}
          sections={redeemModalSections}
          defaultSelectedSectionKey={redeemSectionKey}
          defaultSelectedConditionId={redeemDefaultConditionId}
          onClaimSuccess={(conditionIds) => {
            setClaimedConditionIds((current) => {
              const next = { ...current }
              conditionIds.forEach((conditionId) => {
                next[conditionId] = true
              })
              return next
            })
          }}
        />
      )}

      <SportsLivestreamFloatingPlayer />
    </>
  )
}
