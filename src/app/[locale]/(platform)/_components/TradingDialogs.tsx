'use client'

import type { ComponentProps } from 'react'
import { CheckIcon, CircleDollarSignIcon, Loader2Icon, WalletIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { cn } from '@/lib/utils'

type ProxyStep = 'idle' | 'signing' | 'deploying' | 'completed'
type TradingAuthStep = 'idle' | 'signing' | 'completed'

interface TradingStepsProps {
  proxyStep: ProxyStep
  tradingAuthStep: TradingAuthStep
  approvalsStep: TradingAuthStep
  hasTradingAuth: boolean
  hasDeployedProxyWallet: boolean
  proxyWalletError: string | null
  tradingAuthError: string | null
  tokenApprovalError: string | null
  onProxyAction: () => void
  onTradingAuthAction: () => void
  onApprovalsAction: () => void
}

interface TradingStepsListProps extends TradingStepsProps {
  siteName: string
}

interface EnableTradingDialogProps extends TradingStepsProps {
  open: boolean
  onOpenChange: ComponentProps<typeof Dialog>['onOpenChange']
}

interface FundAccountDialogProps {
  open: boolean
  onOpenChange: ComponentProps<typeof Dialog>['onOpenChange']
  onDeposit: () => void
  onSkip: () => void
}

export function EnableTradingDialog({
  open,
  onOpenChange,
  ...stepsProps
}: EnableTradingDialogProps) {
  const site = useSiteIdentity()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          <div className="space-y-6">
            <DrawerHeader className="space-y-3 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <WalletIcon className="size-8" />
              </div>
              <DrawerTitle className="text-center text-2xl font-bold">Enable Trading</DrawerTitle>
              <DrawerDescription className="text-center text-base text-muted-foreground">
                {`Let's set up your wallet to trade on ${site.name}.`}
              </DrawerDescription>
            </DrawerHeader>

            <TradingStepsList siteName={site.name} {...stepsProps} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border bg-background p-8 text-center">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletIcon className="size-8" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">Enable Trading</DialogTitle>
          <DialogDescription className="text-center text-base text-muted-foreground">
            {`Let's set up your wallet to trade on ${site.name}.`}
          </DialogDescription>
        </DialogHeader>

        <TradingStepsList siteName={site.name} {...stepsProps} />
      </DialogContent>
    </Dialog>
  )
}

export function FundAccountDialog({
  open,
  onOpenChange,
  onDeposit,
  onSkip,
}: FundAccountDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6 text-center">
          <div className="space-y-6">
            <DrawerHeader className="space-y-3 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CircleDollarSignIcon className="size-8" />
              </div>
              <DrawerTitle className="text-center text-2xl font-bold">Fund Your Account</DrawerTitle>
            </DrawerHeader>

            <div className="space-y-4">
              <Button className="h-12 w-full text-base" onClick={onDeposit}>
                Deposit Funds
              </Button>

              <button
                type="button"
                className="
                  mx-auto block text-sm font-medium text-muted-foreground transition-colors
                  hover:text-foreground
                "
                onClick={onSkip}
              >
                Skip for now
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border bg-background p-8 text-center">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CircleDollarSignIcon className="size-8" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">Fund Your Account</DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <Button className="h-12 w-full text-base" onClick={onDeposit}>
            Deposit Funds
          </Button>

          <button
            type="button"
            className="mx-auto block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={onSkip}
          >
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TradingStepsList({
  siteName,
  proxyStep,
  tradingAuthStep,
  approvalsStep,
  hasTradingAuth,
  hasDeployedProxyWallet,
  proxyWalletError,
  tradingAuthError,
  tokenApprovalError,
  onProxyAction,
  onTradingAuthAction,
  onApprovalsAction,
}: TradingStepsListProps) {
  const tradingAuthSatisfied = hasTradingAuth || tradingAuthStep === 'completed'
  const proxyReadyForTrading = hasDeployedProxyWallet || proxyStep === 'deploying' || proxyStep === 'completed'

  return (
    <div className="mt-6 space-y-6 text-left">
      <TradingRequirementStep
        title="Deploy Proxy Wallet"
        description={`Deploy your proxy wallet to trade on ${siteName}.`}
        actionLabel={proxyStep === 'signing' ? 'Signing…' : proxyStep === 'deploying' ? 'Deploying' : 'Deploy'}
        isLoading={proxyStep === 'signing'}
        disabled={proxyStep === 'signing' || proxyStep === 'deploying'}
        isComplete={proxyStep === 'completed'}
        error={proxyWalletError}
        onAction={onProxyAction}
      />

      <Separator className="bg-border/70" />

      <TradingRequirementStep
        title="Enable Trading"
        description="You need to sign this each time you trade on a new browser."
        actionLabel={tradingAuthStep === 'signing' ? 'Signing…' : 'Sign'}
        isLoading={tradingAuthStep === 'signing'}
        disabled={!proxyReadyForTrading || tradingAuthStep === 'completed' || tradingAuthStep === 'signing'}
        isComplete={tradingAuthStep === 'completed'}
        error={tradingAuthError}
        onAction={onTradingAuthAction}
      />

      <Separator className="bg-border/70" />

      <TradingRequirementStep
        title="Approve Tokens"
        description="Start trading securely with your USDC."
        actionLabel={approvalsStep === 'signing' ? 'Signing…' : 'Sign'}
        isLoading={approvalsStep === 'signing'}
        disabled={
          !tradingAuthSatisfied
          || !hasDeployedProxyWallet
          || approvalsStep === 'completed'
          || approvalsStep === 'signing'
        }
        isComplete={approvalsStep === 'completed'}
        error={tokenApprovalError}
        onAction={onApprovalsAction}
      />
    </div>
  )
}

function TradingRequirementStep({
  title,
  description,
  actionLabel,
  isLoading,
  disabled,
  isComplete,
  error,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  isLoading: boolean
  disabled?: boolean
  isComplete: boolean
  error?: string | null
  onAction: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {!isComplete && error && (
            <p className="mt-2 text-sm break-all text-destructive">{error}</p>
          )}
        </div>

        {isComplete
          ? (
              <div className="flex min-w-27.5 items-center justify-center gap-1 text-sm font-semibold text-primary">
                <CheckIcon className="size-4" />
                Complete
              </div>
            )
          : (
              <Button
                size="sm"
                className={cn('min-w-27.5', { 'pointer-events-none opacity-80': isLoading })}
                disabled={Boolean(disabled) || isLoading}
                onClick={onAction}
              >
                {isLoading ? <Loader2Icon className="size-4 animate-spin" /> : actionLabel}
              </Button>
            )}
      </div>
    </div>
  )
}
