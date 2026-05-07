'use client'

import { useEffect, useRef } from 'react'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'

function useStartDepositFlowOnRequest(requestId: number) {
  const { startDepositFlow } = useTradingOnboarding()
  const lastRequestIdRef = useRef(0)

  useEffect(function startDepositFlowWhenRequestIdChanges() {
    if (requestId === 0 || lastRequestIdRef.current === requestId) {
      return
    }

    lastRequestIdRef.current = requestId
    startDepositFlow()
  }, [requestId, startDepositFlow])
}

interface HeaderDepositFlowInnerProps {
  requestId: number
}

function HeaderDepositFlowInner({ requestId }: HeaderDepositFlowInnerProps) {
  useStartDepositFlowOnRequest(requestId)

  return null
}

interface HeaderDepositFlowProps {
  requestId: number
}

export default function HeaderDepositFlow({ requestId }: HeaderDepositFlowProps) {
  return <HeaderDepositFlowInner requestId={requestId} />
}
