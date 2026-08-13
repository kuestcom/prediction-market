'use client'

import type { ReactNode } from 'react'

import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { BellRingIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSignMessage } from 'wagmi'

import type { CommunityFollowStatus } from '@/lib/community-follows'

import { toast } from '@/components/ui/toast'
import { useAppKit } from '@/hooks/useAppKit'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useTradeAlerts } from '@/hooks/useTradeAlerts'
import { useRouter } from '@/i18n/navigation'
import { clearCommunityAuth, ensureCommunityToken, loadCommunityAuth } from '@/lib/community-auth'
import {
  COMMUNITY_FOLLOW_STATUS_BATCH_LIMIT,
  CommunityFollowRequestError,
  communityFollowQueryKeys,
  fetchCommunityFollowStatuses,
  setCommunityFollow,
} from '@/lib/community-follows'
import { useTradeAlertsStore } from '@/stores/useTradeAlerts'
import { useUser } from '@/stores/useUser'

const WALLET_PATTERN = /^0x[0-9a-f]{40}$/i
const TRADE_ALERT_PROMPT_TOAST_ID = 'community-follow-push-prompt'

interface CommunityFollowContextValue {
  getStatus: (wallet: string) => CommunityFollowStatus
  isPending: (wallet: string) => boolean
  registerWallet: (wallet: string) => () => void
  toggleFollow: (wallet: string) => Promise<void>
  viewerWallets: ReadonlySet<string>
}

function normalizeWallet(wallet: string | null | undefined) {
  const normalized = wallet?.trim().toLowerCase() ?? ''
  return WALLET_PATTERN.test(normalized) ? normalized : null
}

function defaultStatus(wallet: string): CommunityFollowStatus {
  return { wallet, isFollowing: false, followersCount: 0, followingCount: 0, profile: null }
}

const CommunityFollowContext = createContext<CommunityFollowContextValue | null>(null)

export function CommunityFollowsProvider({ children }: { children: ReactNode }) {
  const t = useExtracted()
  const { open } = useAppKit()
  const router = useRouter()
  const user = useUser()
  const tradeAlerts = useTradeAlerts()
  const { isIos, isStandalone } = usePwaInstall()
  const { communityUrl } = usePublicRuntimeConfig()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const queryClient = useQueryClient()
  const registrations = useRef(new Map<string, number>())
  const pendingRef = useRef(new Set<string>())
  const pushPromptShownRef = useRef(false)
  const [registeredWallets, setRegisteredWallets] = useState<string[]>([])
  const [pendingWallets, setPendingWallets] = useState<ReadonlySet<string>>(new Set())
  const [overrides, setOverrides] = useState<ReadonlyMap<string, CommunityFollowStatus>>(new Map())
  const [authRevision, setAuthRevision] = useState(0)
  const viewerAddress = normalizeWallet(user?.address)
  const viewerDepositWallet = normalizeWallet(user?.deposit_wallet_address)
  const viewerWallets = useMemo(
    () => new Set([viewerAddress, viewerDepositWallet].filter((wallet): wallet is string => Boolean(wallet))),
    [viewerAddress, viewerDepositWallet],
  )
  const communityToken = viewerAddress ? (loadCommunityAuth(viewerAddress)?.token ?? null) : null
  void authRevision

  useEffect(() => {
    setOverrides(new Map())
    pendingRef.current.clear()
    pushPromptShownRef.current = false
    setPendingWallets(new Set())
    void queryClient.invalidateQueries({ queryKey: communityFollowQueryKeys.all })
  }, [queryClient, viewerAddress, viewerDepositWallet])

  const sortedWallets = useMemo(() => [...registeredWallets].sort(), [registeredWallets])
  const walletChunks = useMemo(() => {
    const chunks: string[][] = []
    for (let index = 0; index < sortedWallets.length; index += COMMUNITY_FOLLOW_STATUS_BATCH_LIMIT) {
      chunks.push(sortedWallets.slice(index, index + COMMUNITY_FOLLOW_STATUS_BATCH_LIMIT))
    }
    return chunks
  }, [sortedWallets])
  const statusQueries = useQueries({
    queries: walletChunks.map((wallets) => ({
      queryKey: communityFollowQueryKeys.status(communityUrl, viewerAddress ?? 'anonymous', wallets),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchCommunityFollowStatuses({ communityApiUrl: communityUrl, wallets, token: communityToken, signal }),
      enabled: Boolean(communityToken),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  })
  const serverStatuses = useMemo(() => {
    const statuses = new Map<string, CommunityFollowStatus>()
    statusQueries.forEach((query) => query.data?.forEach((status) => statuses.set(status.wallet, status)))
    return statuses
  }, [statusQueries])

  const getStatus = useCallback(
    (wallet: string) => {
      const normalized = normalizeWallet(wallet) ?? wallet.toLowerCase()
      return overrides.get(normalized) ?? serverStatuses.get(normalized) ?? defaultStatus(normalized)
    },
    [overrides, serverStatuses],
  )

  const updateStatusCaches = useCallback(
    (status: CommunityFollowStatus) => {
      queryClient.setQueriesData<CommunityFollowStatus[]>(
        { queryKey: communityFollowQueryKeys.statusRoot(communityUrl) },
        (current) => current?.map((item) => (item.wallet === status.wallet ? status : item)),
      )
    },
    [communityUrl, queryClient],
  )

  const offerTradeAlerts = useCallback(async () => {
    if (pushPromptShownRef.current) {
      return
    }
    pushPromptShownRef.current = true
    try {
      await tradeAlerts.refreshState()
    } catch {
      return
    }
    const state = useTradeAlertsStore.getState()
    const needsIosSetup = isIos && !isStandalone
    if (state.enabled || (state.permission === 'unsupported' && !needsIosSetup)) {
      return
    }

    const needsSettings = state.permission === 'denied' || needsIosSetup
    function openSettings() {
      router.push('/settings/notifications')
    }
    let enableInFlight = false
    async function enableFromPrompt() {
      if (enableInFlight) {
        return
      }
      enableInFlight = true
      try {
        const enabled = await tradeAlerts.enable()
        toast.dismiss(TRADE_ALERT_PROMPT_TOAST_ID)
        if (enabled) {
          toast.success(t('Trade alerts enabled.'))
          return
        }
        toast.warning(t('Notifications are blocked. Enable them in your browser or system settings.'), {
          action: { label: t('Settings'), onClick: openSettings },
        })
      } catch {
        toast.dismiss(TRADE_ALERT_PROMPT_TOAST_ID)
        toast.error(t('Could not update trade alerts. Please try again.'))
      } finally {
        enableInFlight = false
      }
    }

    toast.message(t('Enable push notifications'), {
      id: TRADE_ALERT_PROMPT_TOAST_ID,
      icon: <BellRingIcon aria-hidden className="size-5 text-primary" />,
      description: needsIosSetup
        ? t('Add this site to your Home Screen to enable notifications.')
        : needsSettings
          ? t('Notifications are blocked. Enable them in your browser or system settings.')
          : t('Get trade alerts from people you follow on this device.'),
      duration: 12_000,
      action: needsSettings
        ? { label: t('Settings'), onClick: openSettings }
        : { control: 'switch', label: t('Enable'), onClick: () => void enableFromPrompt() },
    })
  }, [isIos, isStandalone, router, t, tradeAlerts])

  const mutation = useMutation({
    mutationKey: [...communityFollowQueryKeys.all, 'toggle'],
    mutationFn: async ({ wallet, following }: { wallet: string; following: boolean }) => {
      if (!viewerAddress) {
        throw new Error('Connect your wallet to follow traders.')
      }
      const authenticatedAddress = viewerAddress

      function getToken(forceRefresh = false) {
        return ensureCommunityToken({
          address: authenticatedAddress,
          depositWalletAddress: viewerDepositWallet,
          communityApiUrl: communityUrl,
          forceRefresh,
          signMessageAsync: (args) => runWithSignaturePrompt(() => signMessageAsync(args)),
        })
      }
      let token = await getToken()

      try {
        return await setCommunityFollow({ communityApiUrl: communityUrl, wallet, token, following })
      } catch (error) {
        if (!(error instanceof CommunityFollowRequestError) || error.status !== 401) {
          throw error
        }
        clearCommunityAuth()
        token = await getToken(true)
        return await setCommunityFollow({ communityApiUrl: communityUrl, wallet, token, following })
      }
    },
  })

  const toggleFollow = useCallback(
    async (wallet: string) => {
      const normalized = normalizeWallet(wallet)
      if (!normalized || viewerWallets.has(normalized) || pendingRef.current.has(normalized)) {
        return
      }
      if (!viewerAddress) {
        void open({ view: 'Connect' })
        return
      }

      const previous = getStatus(normalized)
      const following = !previous.isFollowing
      const optimistic: CommunityFollowStatus = {
        ...previous,
        isFollowing: following,
        followersCount: Math.max(0, previous.followersCount + (following ? 1 : -1)),
      }
      pendingRef.current.add(normalized)
      setPendingWallets(new Set(pendingRef.current))
      setOverrides((current) => new Map(current).set(normalized, optimistic))
      updateStatusCaches(optimistic)

      try {
        const result = await mutation.mutateAsync({ wallet: normalized, following })
        setOverrides((current) => new Map(current).set(normalized, result))
        updateStatusCaches(result)
        setAuthRevision((current) => current + 1)
        if (following && result.isFollowing) {
          void offerTradeAlerts()
        }
      } catch (error) {
        setOverrides((current) => new Map(current).set(normalized, previous))
        updateStatusCaches(previous)
        toast.error(error instanceof Error ? error.message : t('Could not update follow status.'))
      } finally {
        pendingRef.current.delete(normalized)
        setPendingWallets(new Set(pendingRef.current))
      }
    },
    [getStatus, mutation, offerTradeAlerts, open, t, updateStatusCaches, viewerAddress, viewerWallets],
  )

  const registerWallet = useCallback((wallet: string) => {
    const normalized = normalizeWallet(wallet)
    if (!normalized) {
      return () => undefined
    }

    const count = registrations.current.get(normalized) ?? 0
    registrations.current.set(normalized, count + 1)
    if (count === 0) {
      setRegisteredWallets((current) => [...current, normalized])
    }

    return () => {
      const nextCount = (registrations.current.get(normalized) ?? 1) - 1
      if (nextCount > 0) {
        registrations.current.set(normalized, nextCount)
        return
      }
      registrations.current.delete(normalized)
      setRegisteredWallets((current) => current.filter((item) => item !== normalized))
    }
  }, [])

  const value = useMemo<CommunityFollowContextValue>(
    () => ({
      getStatus,
      isPending: (wallet) => pendingWallets.has(normalizeWallet(wallet) ?? ''),
      registerWallet,
      toggleFollow,
      viewerWallets,
    }),
    [getStatus, pendingWallets, registerWallet, toggleFollow, viewerWallets],
  )

  return <CommunityFollowContext value={value}>{children}</CommunityFollowContext>
}

export function useCommunityFollow(wallet: string | null | undefined) {
  const context = useContext(CommunityFollowContext)
  if (!context) {
    throw new Error('useCommunityFollow must be used within CommunityFollowsProvider.')
  }
  const normalizedWallet = normalizeWallet(wallet)
  const registerWallet = context.registerWallet

  useEffect(() => (normalizedWallet ? registerWallet(normalizedWallet) : undefined), [normalizedWallet, registerWallet])

  const status = normalizedWallet ? context.getStatus(normalizedWallet) : defaultStatus('')
  return {
    ...status,
    canFollow: Boolean(normalizedWallet && !context.viewerWallets.has(normalizedWallet)),
    isPending: normalizedWallet ? context.isPending(normalizedWallet) : false,
    toggleFollow: () => (normalizedWallet ? context.toggleFollow(normalizedWallet) : Promise.resolve()),
  }
}
