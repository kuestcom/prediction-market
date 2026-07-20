'use client'

import AdminHeaderBalances from '@/app/[locale]/admin/_components/AdminHeaderBalances'
import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUser } from '@/stores/useUser'

export default function AdminHeaderActions({ feeRecipientWallet }: { feeRecipientWallet: string }) {
  const isMobile = useIsMobile()
  const user = useUser()

  return (
    <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
      {user && !isMobile && <AdminHeaderBalances feeRecipientWallet={feeRecipientWallet} />}
      {user && !isMobile && <div className="h-8 w-px bg-border/80" aria-hidden="true" />}
      {user && !isMobile && <HeaderPortfolio />}
      <HeaderDropdownUserMenuAuth />
    </div>
  )
}
