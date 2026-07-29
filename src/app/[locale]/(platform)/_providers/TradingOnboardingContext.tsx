'use client'

import { createContext, use } from 'react'

import type { SumsubVerificationStatus } from '@/lib/sumsub/types'

export interface TradingOnboardingContextValue {
  startDepositFlow: () => void
  startWithdrawFlow: () => void
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean; onTradingReady?: () => void }) => void
  promptAutoRedeem: () => boolean
  hasDepositWallet: boolean
  sumsubStatus: SumsubVerificationStatus
  openWalletModal: () => void
}

export const TradingOnboardingContext = createContext<TradingOnboardingContextValue | null>(null)

export function useTradingOnboarding() {
  const context = use(TradingOnboardingContext)
  if (!context) {
    throw new Error('useTradingOnboarding must be used within TradingOnboardingProvider')
  }
  return context
}

export function useOptionalTradingOnboarding() {
  return use(TradingOnboardingContext)
}
