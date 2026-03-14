'use client'

import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const HeaderDepositFlow = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HeaderDepositFlow'),
  { ssr: false },
)

export default function HeaderDepositButton() {
  const t = useExtracted()
  const [requestId, setRequestId] = useState(0)

  function handleClick() {
    setRequestId(prev => prev + 1)
  }

  return (
    <>
      <Button size="headerCompact" onClick={handleClick}>
        {t('Deposit')}
      </Button>
      {requestId > 0 && <HeaderDepositFlow requestId={requestId} />}
    </>
  )
}
