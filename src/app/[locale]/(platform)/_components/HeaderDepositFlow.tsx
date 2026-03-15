'use client'

import { useEffect, useRef } from 'react'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'

interface HeaderDepositFlowInnerProps {
  requestId: number
}

function HeaderDepositFlowInner({ requestId }: HeaderDepositFlowInnerProps) {
  const { startDepositFlow } = useTradingOnboarding()
  const lastRequestIdRef = useRef(0)

  useEffect(() => {
    if (requestId === 0 || lastRequestIdRef.current === requestId) {
      return
    }

    lastRequestIdRef.current = requestId
    startDepositFlow()
  }, [requestId, startDepositFlow])

  return null
}

interface HeaderDepositFlowProps {
  requestId: number
}

export default function HeaderDepositFlow({ requestId }: HeaderDepositFlowProps) {
  return (
    <TradingOnboardingProvider>
      <HeaderDepositFlowInner requestId={requestId} />
    </TradingOnboardingProvider>
  )
}
