'use client'

import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUser } from '@/stores/useUser'

export default function AdminHeaderActions() {
  const isMobile = useIsMobile()
  const user = useUser()

  return (
    <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
      {user && !isMobile && <HeaderPortfolio />}
      <HeaderDropdownUserMenuAuth />
    </div>
  )
}
