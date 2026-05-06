import type { FormEvent, ReactNode } from 'react'
import type { User } from '@/types'
import {
  AtSignIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  Loader2Icon,
  LockKeyholeIcon,
  MailIcon,
  WalletIcon,
  ZapIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { checkUsernameAvailabilityAction } from '@/app/[locale]/(platform)/_actions/deposit-wallet'
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

type OnboardingModal = 'username' | 'email' | 'enable' | 'enable-status' | 'approve' | 'auto-redeem' | null
type EnableTradingStep = 'idle' | 'enabling' | 'deploying' | 'completed'
type ApprovalsStep = 'idle' | 'signing' | 'completed'
type UsernameAvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

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
  hasDeployedDepositWallet: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
  approvalsStep: ApprovalsStep
  tokenApprovalError: string | null
  onApproveTokens: () => void
  autoRedeemStep: ApprovalsStep
  autoRedeemError: string | null
  onApproveAutoRedeem: () => void
  fundModalOpen: boolean
  onFundOpenChange: (open: boolean) => void
  onFundDeposit: () => void
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
  const [availabilityState, setAvailabilityState] = useState<UsernameAvailabilityState>('idle')
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const trimmedUsername = username.trim()
  const localFormatError = resolveUsernameFormatError(trimmedUsername, t)
  const canSubmit = (
    !isSubmitting
    && termsAccepted
    && !localFormatError
    && availabilityState === 'available'
  )

  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react/set-state-in-effect -- Debounced username availability is derived from input and an async data-api response. */
  useEffect(() => {
    if (!open) {
      return
    }

    if (localFormatError) {
      setAvailabilityState('idle')
      setAvailabilityMessage(null)
      return
    }

    if (!trimmedUsername) {
      setAvailabilityState('idle')
      setAvailabilityMessage(null)
      return
    }

    if (defaultValue && trimmedUsername.toLowerCase() === defaultValue.trim().toLowerCase()) {
      setAvailabilityState('available')
      setAvailabilityMessage(t('Username is available.'))
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setAvailabilityState('checking')
      setAvailabilityMessage(t('Checking username availability...'))

      checkUsernameAvailabilityAction({ username: trimmedUsername })
        .then((result) => {
          if (cancelled) {
            return
          }

          if (result.available === true) {
            setAvailabilityState('available')
            setAvailabilityMessage(t('Username is available.'))
            return
          }

          if (result.available === false || result.code === 'username_taken') {
            setAvailabilityState('taken')
            setAvailabilityMessage(t('That username is already taken.'))
            return
          }

          setAvailabilityState('error')
          setAvailabilityMessage(t('We could not check username availability. Try again.'))
        })
        .catch(() => {
          if (!cancelled) {
            setAvailabilityState('error')
            setAvailabilityMessage(t('We could not check username availability. Try again.'))
          }
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [defaultValue, localFormatError, open, t, trimmedUsername])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react/set-state-in-effect */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    onSubmit(trimmedUsername, termsAccepted)
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
            onChange={(event) => {
              setUsername(event.target.value)
              setAvailabilityMessage(null)
              setAvailabilityState('idle')
            }}
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
        {!error && localFormatError && <InputError message={localFormatError} />}
        {!error && !localFormatError && availabilityMessage && (
          availabilityState === 'available'
            ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <CircleCheckIcon className="size-4" />
                  {availabilityMessage}
                </p>
              )
            : availabilityState === 'checking'
              ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    {availabilityMessage}
                  </p>
                )
              : <InputError message={availabilityMessage} />
        )}

        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={!canSubmit}
        >
          {isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : t('Continue')}
        </Button>
      </form>
    </OnboardingDialogShell>
  )
}

function resolveUsernameFormatError(
  username: string,
  t: ReturnType<typeof useExtracted>,
) {
  if (!username) {
    return null
  }
  if (username.length < 3) {
    return t('Username must be at least 3 characters long.')
  }
  if (username.length > 42) {
    return t('Username must be at most 42 characters long.')
  }
  if (!/^[A-Z0-9.-]+$/i.test(username)) {
    return t('Only letters, numbers, dots, and hyphens are allowed.')
  }
  if (/^[.-]/.test(username)) {
    return t('Username cannot start with a dot or hyphen.')
  }
  if (/[.-]$/.test(username)) {
    return t('Username cannot end with a dot or hyphen.')
  }
  return null
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

function EnableTradingStatusDialog({
  open,
  onOpenChange,
  step,
  error,
  hasDeployedDepositWallet,
  hasTradingAuth,
  hasTokenApprovals,
  onEnableTrading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: EnableTradingStep
  error: string | null
  hasDeployedDepositWallet: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
  onEnableTrading: () => void
}) {
  const t = useExtracted()
  const isSigning = step === 'enabling'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border bg-background p-6">
        <DialogHeader className="space-y-2 text-center">
          <DialogTitle className="text-center text-xl font-bold text-foreground">
            {t('Enable Trading')}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-5 space-y-0">
          <TimelineStep
            title={t('Deploy Wallet')}
            description={t('Deploy a smart contract wallet to enable trading')}
            complete={hasDeployedDepositWallet}
            trailing={hasDeployedDepositWallet ? t('Done') : null}
          />
          <TimelineStep
            title={t('Enable Trading')}
            description={t('Sign a message to generate your API keys')}
            complete={hasTradingAuth}
            trailing={hasTradingAuth ? t('Done') : null}
            action={!hasTradingAuth && hasDeployedDepositWallet
              ? {
                  label: t('Sign'),
                  loading: isSigning,
                  onClick: onEnableTrading,
                }
              : undefined}
            error={!hasTradingAuth ? error : null}
          />
          <TimelineStep
            title={t('Approve Tokens')}
            description={t('Approve token spending for trading')}
            complete={hasTokenApprovals}
            trailing={hasTokenApprovals ? t('Done') : null}
            isLast
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TimelineStep({
  title,
  description,
  complete,
  trailing,
  action,
  error,
  isLast = false,
}: {
  title: string
  description: string
  complete: boolean
  trailing?: string | null
  action?: {
    label: string
    loading: boolean
    onClick: () => void
  }
  error?: string | null
  isLast?: boolean
}) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_auto] gap-x-3">
      <div className="flex flex-col items-center">
        <div className={`
          flex size-6 items-center justify-center rounded-full border text-xs
          ${complete
      ? 'border-primary bg-primary text-primary-foreground'
      : `border-muted-foreground/30 bg-muted text-muted-foreground`}
        `}
        >
          {complete ? <CheckIcon className="size-3.5" /> : null}
        </div>
        {!isLast && <div className="h-full min-h-10 w-px bg-border" />}
      </div>
      <div className="pb-5">
        <p className={complete ? 'font-medium text-foreground' : 'font-medium text-muted-foreground'}>{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error && <InputError message={error} />}
      </div>
      <div className="pb-5">
        {action
          ? (
              <Button
                type="button"
                size="sm"
                className="min-w-20"
                disabled={action.loading}
                onClick={action.onClick}
              >
                {action.loading ? <Loader2Icon className="size-4 animate-spin" /> : action.label}
              </Button>
            )
          : trailing
            ? <span className="text-sm font-semibold text-primary">{trailing}</span>
            : null}
      </div>
    </div>
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

function AutoRedeemDialog({
  open,
  onOpenChange,
  step,
  error,
  onApproveAutoRedeem,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: ApprovalsStep
  error: string | null
  onApproveAutoRedeem: () => void
}) {
  const t = useExtracted()
  const isLoading = step === 'signing'

  return (
    <OnboardingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('Get Paid Instantly')}
      description={t('When you win, your payout hits your balance automatically. No more manual steps.')}
      icon={(
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ZapIcon className="size-10" />
        </div>
      )}
    >
      <div className="mt-6 space-y-5">
        <div className="space-y-4 text-left">
          <AutoRedeemBenefit
            icon={<ZapIcon className="size-5" />}
            title={t('One-time approval')}
            description={t('Sign a single transaction and you\'re set')}
          />
          <AutoRedeemBenefit
            icon={<ClockIcon className="size-5" />}
            title={t('Starts after your next trade')}
            description={t('Manually redeem winnings one last time.')}
          />
          <AutoRedeemBenefit
            icon={<LockKeyholeIcon className="size-5" />}
            title={t('Always on')}
            description={t('Once enabled, it stays on permanently.')}
          />
        </div>

        {error && <InputError message={error} />}

        <Button
          className="h-12 w-full text-base"
          disabled={isLoading || step === 'completed'}
          onClick={onApproveAutoRedeem}
        >
          {isLoading
            ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('Approving...')}
                </>
              )
            : t('Enable Auto-Redeem')}
        </Button>
      </div>
    </OnboardingDialogShell>
  )
}

function AutoRedeemBenefit({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
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
  hasDeployedDepositWallet,
  hasTradingAuth,
  hasTokenApprovals,
  approvalsStep,
  tokenApprovalError,
  onApproveTokens,
  autoRedeemStep,
  autoRedeemError,
  onApproveAutoRedeem,
  fundModalOpen,
  onFundOpenChange,
  onFundDeposit,
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

      <EnableTradingStatusDialog
        open={activeModal === 'enable-status'}
        onOpenChange={open => onModalOpenChange('enable-status', open)}
        step={enableTradingStep}
        error={enableTradingError}
        hasDeployedDepositWallet={hasDeployedDepositWallet}
        hasTradingAuth={hasTradingAuth}
        hasTokenApprovals={hasTokenApprovals}
        onEnableTrading={onEnableTrading}
      />

      <ApproveTokensDialog
        open={activeModal === 'approve'}
        onOpenChange={open => onModalOpenChange('approve', open)}
        step={approvalsStep}
        error={tokenApprovalError}
        onApproveTokens={onApproveTokens}
      />

      <AutoRedeemDialog
        open={activeModal === 'auto-redeem'}
        onOpenChange={open => onModalOpenChange('auto-redeem', open)}
        step={autoRedeemStep}
        error={autoRedeemError}
        onApproveAutoRedeem={onApproveAutoRedeem}
      />

      <FundAccountDialog
        open={fundModalOpen}
        onOpenChange={onFundOpenChange}
        onDeposit={onFundDeposit}
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
