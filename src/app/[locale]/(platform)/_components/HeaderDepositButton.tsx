'use client'

import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

const HeaderDepositFlow = dynamic(() => import('@/app/[locale]/(platform)/_components/HeaderDepositFlow'), {
  ssr: false,
})

function useDepositRequestTrigger() {
  const [requestId, setRequestId] = useState(0)

  function handleClick() {
    setRequestId((prev) => prev + 1)
  }

  return { requestId, handleClick }
}

export default function HeaderDepositButton() {
  const t = useExtracted()
  const { requestId, handleClick } = useDepositRequestTrigger()

  return (
    <>
      <Button size="sm" onClick={handleClick}>
        {t('Deposit')}
      </Button>
      {requestId > 0 && <HeaderDepositFlow requestId={requestId} />}
    </>
  )
}
