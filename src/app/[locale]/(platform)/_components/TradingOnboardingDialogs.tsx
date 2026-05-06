import type { FormEvent, ReactNode } from 'react'
import type { User } from '@/types'
import { AtSignIcon, Loader2Icon, MailIcon, WalletIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { FundAccountDialog } from '@/app/[locale]/(platform)/_components/TradingDialogs'
import { WalletFlow } from '@/app/[locale]/(platform)/_components/WalletFlow'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

type OnboardingModal = 'username' | 'email' | 'enable' | 'approve' | null
type EnableTradingStep = 'idle' | 'enabling' | 'deploying' | 'completed'
type ApprovalsStep = 'idle' | 'signing' | 'completed'

interface TradingOnboardingDialogsProps {
  activeModal: OnboardingModal
  onModalOpenChange: (modal: Exclude<OnboardingModal, null>, open: boolean) => void
  usernameDefaultValue: string
  usernameError: string | null
  isUsernameSubmitting: boolean
  onUsernameSubmit: (username: string, termsAccepted: boolean) => void
  emailDefaultValue: string
  emailError: string | null
  isEmailSubmitting: boolean
  onEmailSubmit: (email: string) => void
  onEmailSkip: () => void
  enableTradingStep: EnableTradingStep
  enableTradingError: string | null
  onEnableTrading: () => void
  approvalsStep: ApprovalsStep
  tokenApprovalError: string | null
  onApproveTokens: () => void
  fundModalOpen: boolean
  onFundOpenChange: (open: boolean) => void
  onFundDeposit: () => void
  onFundSkip: () => void
  depositModalOpen: boolean
  onDepositOpenChange: (open: boolean) => void
  withdrawModalOpen: boolean
  onWithdrawOpenChange: (open: boolean) => void
  user: User | null
  meldUrl: string | null
}

function OnboardingDialogShell({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon?: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border bg-background p-8">
        <DialogHeader className="space-y-3 text-center">
          {icon}
          <DialogTitle className="text-center text-2xl font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-base text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function UsernameDialog({
  open,
  onOpenChange,
  defaultValue,
  error,
  isSubmitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue: string
  error: string | null
  isSubmitting: boolean
  onSubmit: (username: string, termsAccepted: boolean) => void
}) {
  const t = useExtracted()
  const [username, setUsername] = useState(defaultValue)
  const [termsAccepted, setTermsAccepted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(username.trim(), termsAccepted)
  }

  return (
    <OnboardingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('Choose a username')}
      description={t('You can update this later.')}
    >
      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="relative">
          <AtSignIcon className="
            pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground
          "
          />
          <Input
            value={username}
            onChange={event => setUsername(event.target.value)}
            placeholder={t('username')}
            className="h-14 pl-12 text-lg"
            maxLength={42}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox
            checked={termsAccepted}
            onCheckedChange={checked => setTermsAccepted(checked === true)}
            disabled={isSubmitting}
            className="mt-0.5"
          />
          <span>
            {t('I agree to the')}
            {' '}
            <AppLink
              href="/tos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {t('terms of service')}
            </AppLink>
          </span>
        </label>

        {error && <InputError message={error} />}

        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={isSubmitting || username.trim().length < 3 || !termsAccepted}
        >
          {isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : t('Continue')}
        </Button>
      </form>
    </OnboardingDialogShell>
  )
}

function EmailDialog({
  open,
  onOpenChange,
  defaultValue,
  error,
  isSubmitting,
  onSubmit,
  onSkip,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue: string
  error: string | null
  isSubmitting: boolean
  onSubmit: (email: string) => void
  onSkip: () => void
}) {
  const t = useExtracted()
  const [email, setEmail] = useState(defaultValue)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(email.trim())
  }

  return (
    <OnboardingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('What\'s your email?')}
      description={t('Add your email to receive market and trading notifications.')}
      icon={(
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailIcon className="size-8" />
        </div>
      )}
    >
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder={t('Email address')}
          type="email"
          className="h-12 text-base"
          disabled={isSubmitting}
          autoFocus
        />

        {error && <InputError message={error} />}

        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={isSubmitting || email.trim().length === 0}
        >
          {isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : t('Continue')}
        </Button>

        <button
          type="button"
          className="mx-auto block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          disabled={isSubmitting}
          onClick={onSkip}
        >
          {t('Do this later')}
        </button>
      </form>
    </OnboardingDialogShell>
  )
}

function EnableTradingDialog({
  open,
  onOpenChange,
  step,
  error,
  onEnableTrading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: EnableTradingStep
  error: string | null
  onEnableTrading: () => void
}) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const isLoading = step === 'enabling' || step === 'deploying'

  return (
    <OnboardingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('Enable Trading')}
      description={t('Let\'s set up your wallet to trade on {siteName}.', { siteName: site.name })}
      icon={(
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <WalletIcon className="size-10" />
        </div>
      )}
    >
      <div className="mt-6 space-y-4">
        {error && <InputError message={error} />}
        <Button
          className="h-12 w-full text-base"
          disabled={isLoading || step === 'completed'}
          onClick={onEnableTrading}
        >
          {isLoading
            ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('Enabling')}
                </>
              )
            : t('Enable Trading')}
        </Button>
      </div>
    </OnboardingDialogShell>
  )
}

function ApproveTokensDialog({
  open,
  onOpenChange,
  step,
  error,
  onApproveTokens,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: ApprovalsStep
  error: string | null
  onApproveTokens: () => void
}) {
  const t = useExtracted()
  const isLoading = step === 'signing'

  return (
    <OnboardingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('Approve Tokens')}
      description={t('Approve token spending for trading')}
      icon={(
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <WalletIcon className="size-10" />
        </div>
      )}
    >
      <div className="mt-6 space-y-4">
        {error && <InputError message={error} />}
        <Button
          className="h-12 w-full text-base"
          disabled={isLoading || step === 'completed'}
          onClick={onApproveTokens}
        >
          {isLoading
            ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('Check your wallet...')}
                </>
              )
            : t('Sign')}
        </Button>
      </div>
    </OnboardingDialogShell>
  )
}

export default function TradingOnboardingDialogs({
  activeModal,
  onModalOpenChange,
  usernameDefaultValue,
  usernameError,
  isUsernameSubmitting,
  onUsernameSubmit,
  emailDefaultValue,
  emailError,
  isEmailSubmitting,
  onEmailSubmit,
  onEmailSkip,
  enableTradingStep,
  enableTradingError,
  onEnableTrading,
  approvalsStep,
  tokenApprovalError,
  onApproveTokens,
  fundModalOpen,
  onFundOpenChange,
  onFundDeposit,
  onFundSkip,
  depositModalOpen,
  onDepositOpenChange,
  withdrawModalOpen,
  onWithdrawOpenChange,
  user,
  meldUrl,
}: TradingOnboardingDialogsProps) {
  return (
    <>
      <UsernameDialog
        open={activeModal === 'username'}
        onOpenChange={open => onModalOpenChange('username', open)}
        defaultValue={usernameDefaultValue}
        error={usernameError}
        isSubmitting={isUsernameSubmitting}
        onSubmit={onUsernameSubmit}
      />

      <EmailDialog
        open={activeModal === 'email'}
        onOpenChange={open => onModalOpenChange('email', open)}
        defaultValue={emailDefaultValue}
        error={emailError}
        isSubmitting={isEmailSubmitting}
        onSubmit={onEmailSubmit}
        onSkip={onEmailSkip}
      />

      <EnableTradingDialog
        open={activeModal === 'enable'}
        onOpenChange={open => onModalOpenChange('enable', open)}
        step={enableTradingStep}
        error={enableTradingError}
        onEnableTrading={onEnableTrading}
      />

      <ApproveTokensDialog
        open={activeModal === 'approve'}
        onOpenChange={open => onModalOpenChange('approve', open)}
        step={approvalsStep}
        error={tokenApprovalError}
        onApproveTokens={onApproveTokens}
      />

      <FundAccountDialog
        open={fundModalOpen}
        onOpenChange={onFundOpenChange}
        onDeposit={onFundDeposit}
        onSkip={onFundSkip}
      />

      <WalletFlow
        depositOpen={depositModalOpen}
        onDepositOpenChange={onDepositOpenChange}
        withdrawOpen={withdrawModalOpen}
        onWithdrawOpenChange={onWithdrawOpenChange}
        user={user}
        meldUrl={meldUrl}
      />
    </>
  )
}
