'use client'

import { useExtracted } from 'next-intl'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'

function HeaderDepositButtonInner() {
  const t = useExtracted()
  const { startDepositFlow } = useTradingOnboarding()

  return (
    <Button size="headerCompact" onClick={startDepositFlow}>
      {t('Deposit')}
    </Button>
  )
}

export default function HeaderDepositButton() {
  return (
    <TradingOnboardingProvider>
      <HeaderDepositButtonInner />
    </TradingOnboardingProvider>
  )
}
