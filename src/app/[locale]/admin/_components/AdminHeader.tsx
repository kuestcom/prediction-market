import AdminHeaderActions from '@/app/[locale]/admin/_components/AdminHeaderActions'
import HeaderLogo from '@/components/HeaderLogo'
import { DEFAULT_FEE_RECEIVER_WALLET_ADDRESS } from '@/lib/contracts'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getFeeRecipientWalletFormValue } from '@/lib/theme-settings'
import { cn } from '@/lib/utils'

export default async function AdminHeader() {
  const { data: settings } = await SettingsRepository.getSettings()
  const feeRecipientWallet = getFeeRecipientWalletFormValue(settings ?? undefined)
    || DEFAULT_FEE_RECEIVER_WALLET_ADDRESS

  return (
    <header className="sticky top-0 z-30 bg-background">
      <div
        className={cn(`
          relative z-50 container mx-auto flex min-h-15 w-full items-center gap-4 py-3 pb-1
          md:min-h-17 md:pb-2
        `)}
      >
        <HeaderLogo labelSuffix="Admin" />
        <AdminHeaderActions feeRecipientWallet={feeRecipientWallet} />
      </div>
    </header>
  )
}
