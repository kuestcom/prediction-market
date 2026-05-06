'use client'

import type { Dispatch, SetStateAction } from 'react'
import { InfoIcon, WalletIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import AllowedMarketCreatorsManager from '@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUser } from '@/stores/useUser'
import SettingsAccordionSection from './SettingsAccordionSection'

interface MarketFeeSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  feeRecipientWallet: string
  setFeeRecipientWallet: Dispatch<SetStateAction<string>>
}

function MarketFeeSection({
  isPending,
  openSections,
  onToggleSection,
  feeRecipientWallet,
  setFeeRecipientWallet,
}: MarketFeeSectionProps) {
  const t = useExtracted()
  const user = useUser()
  const depositWalletAddress = user?.deposit_wallet_address ?? null
  const canUseDepositWallet = Boolean(depositWalletAddress)

  return (
    <SettingsAccordionSection
      value="market-fees"
      isOpen={openSections.includes('market-fees')}
      onToggle={onToggleSection}
      header={<h3 className="text-base font-medium">{t('Market and fee settings')}</h3>}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="theme-fee-recipient-wallet">
              {t('Your Polygon wallet address to receive transaction fees')}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="size-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                {t('Usando a Deposit Wallet para claim, você não precisa pagar gás diretamente.')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="theme-fee-recipient-wallet"
              name="fee_recipient_wallet"
              maxLength={42}
              value={feeRecipientWallet}
              onChange={event => setFeeRecipientWallet(event.target.value)}
              disabled={isPending}
              placeholder={t('0xabc')}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={isPending || !canUseDepositWallet}
              onClick={() => {
                if (depositWalletAddress) {
                  setFeeRecipientWallet(depositWalletAddress)
                }
              }}
            >
              <WalletIcon className="size-4" />
              {t('Add my Deposit Wallet')}
            </Button>
          </div>
        </div>

        <AllowedMarketCreatorsManager disabled={isPending} />
      </div>
    </SettingsAccordionSection>
  )
}

export default MarketFeeSection
