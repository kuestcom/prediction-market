'use client'

import { createContext, use } from 'react'

export interface TradingOnboardingContextValue {
  startDepositFlow: () => void
  startWithdrawFlow: () => void
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  hasProxyWallet: boolean
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
