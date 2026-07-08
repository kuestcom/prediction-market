import type { AdminCreateEventFormProps } from './admin-create-event-form-types'
import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  UserCheckIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CheckIndicator } from './admin-create-event-form-indicators'
import { getCheckIndicatorState } from './admin-create-event-form-signature-helpers'
import { getAiIssueKey } from './admin-create-event-form-utils'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>
type EventCreationMode = NonNullable<AdminCreateEventFormProps['creationMode']>

const UMA_RESOLUTION_TEMPORARILY_DISABLED = true

function WalletAddressDisplay({
  address,
  isAddressCopied,
  onCopyWalletAddress,
}: {
  address: string | null
  isAddressCopied: boolean
  onCopyWalletAddress: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="font-mono text-sm break-all text-muted-foreground">
        {address ?? 'Wallet not connected'}
      </p>
      {address && (
        <button
          type="button"
          onClick={onCopyWalletAddress}
          className="text-muted-foreground transition hover:text-foreground"
          aria-label="Copy wallet address"
        >
          {isAddressCopied
            ? <CheckIcon className="size-4 text-emerald-500" />
            : (
                <CopyIcon className="size-4" />
              )}
        </button>
      )}
    </div>
  )
}

export function AdminCreateEventStepPreSign({
  state,
  creationMode,
}: {
  state: AdminCreateEventFormState
  creationMode: EventCreationMode
}) {
  const t = useExtracted()
  const {
    allowedCreatorCheckError,
    allowedCreatorCheckState,
    allowedCreatorHasIssue,
    bypassIssue,
    contentCheckError,
    contentCheckProgressLine,
    contentCheckWarnings,
    contentHasIssue,
    contentIndicatorState,
    copyWalletAddress,
    eoaAddress,
    eoaPolBalance,
    eoaUsdcBalance,
    expandedPreSignChecks,
    form,
    fundingCheckError,
    fundingCheckState,
    fundingHasIssue,
    goToIssueStep,
    handleResolutionTypeChange,
    isAddingCreatorWallet,
    isAddressCopied,
    marketCount,
    nativeGasCheckError,
    nativeGasCheckState,
    nativeGasHasIssue,
    openAdminSettings,
    openRouterCheckError,
    openRouterCheckState,
    openRouterHasIssue,
    pendingAiIssues,
    proposerWhitelistCheckError,
    proposerWhitelistCheckState,
    proposerWhitelistHasIssue,
    recurringOccurrencePreviews,
    requiredGasPol,
    requiredRewardUsdc,
    requiredTotalRewardUsdc,
    resolutionType,
    runProposerWhitelistCheck,
    selectedCreatorAddress,
    setCreatorWalletDialogOpen,
    setProposersDialogOpen,
    slugCheckError,
    slugHasIssue,
    slugValidationState,
    togglePreSignCheck,
  } = state

  return (
    <Card className="bg-background">
      <CardHeader className="pt-8 pb-6">
        <CardTitle>Create events and markets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-8">
        <div className="rounded-md border px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-foreground">
                {t('Resolution mode')}
              </p>
              <p className="text-sm text-muted-foreground">
                {resolutionType === 'dro_moov2'
                  ? t('Approved proposers can submit the final result directly.')
                  : t('Use UMA’s oracle and dispute process.')}
              </p>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border">
              {(['dro_moov2', 'uma_moov2'] as const).map((mode) => {
                const isUnavailable = mode === 'uma_moov2' && UMA_RESOLUTION_TEMPORARILY_DISABLED
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-disabled={isUnavailable}
                    className={cn(
                      'px-3 py-2 text-sm font-semibold transition-colors',
                      resolutionType === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground',
                      isUnavailable && 'cursor-not-allowed opacity-60 hover:text-muted-foreground',
                    )}
                    onClick={() => handleResolutionTypeChange(mode)}
                  >
                    {mode === 'dro_moov2'
                      ? t('Direct')
                      : t('UMA')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('funding', fundingHasIssue)}
              disabled={fundingHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                fundingHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.funding
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">
                EOA wallet balance (
                {requiredTotalRewardUsdc.toFixed(2)}
                {' '}
                USDC required)
              </p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(fundingCheckState)}
            />
          </div>
          {expandedPreSignChecks.funding && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">
                {resolutionType === 'dro_moov2'
                  ? t('This direct fee is paid onchain to Kuest when the market request is created.')
                  : t('This reward pays the UMA proposer who resolves the question correctly.')}
              </p>
              <p className="text-sm text-muted-foreground">
                Need
                {' '}
                {requiredRewardUsdc.toFixed(2)}
                {' '}
                ×
                {' '}
                {marketCount}
                {' '}
                markets =
                {' '}
                {requiredTotalRewardUsdc.toFixed(2)}
                {' '}
                USDC. Balance:
                {' '}
                {eoaUsdcBalance.toFixed(2)}
                {' '}
                USDC.
              </p>
              <WalletAddressDisplay
                address={eoaAddress}
                isAddressCopied={isAddressCopied}
                onCopyWalletAddress={() => void copyWalletAddress()}
              />
            </div>
          )}
          {fundingCheckError && <p className="mt-2 text-sm text-destructive">{fundingCheckError}</p>}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('nativeGas', nativeGasHasIssue)}
              disabled={nativeGasHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                nativeGasHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.nativeGas
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">
                EOA wallet gas (
                {requiredGasPol.toFixed(4)}
                {' '}
                POL estimated)
              </p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(nativeGasCheckState)}
            />
          </div>
          {expandedPreSignChecks.nativeGas && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">
                This POL pays gas for market creation transactions (approve + initialize).
              </p>
              <p className="text-sm text-muted-foreground">
                Estimated need:
                {' '}
                {requiredGasPol.toFixed(4)}
                {' '}
                POL. Balance:
                {' '}
                {eoaPolBalance.toFixed(4)}
                {' '}
                POL.
              </p>
              <WalletAddressDisplay
                address={eoaAddress}
                isAddressCopied={isAddressCopied}
                onCopyWalletAddress={() => void copyWalletAddress()}
              />
            </div>
          )}
          {nativeGasCheckError && <p className="mt-2 text-sm text-destructive">{nativeGasCheckError}</p>}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('allowedCreator', allowedCreatorHasIssue)}
              disabled={allowedCreatorHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                allowedCreatorHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.allowedCreator
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">Wallet on allowed market creator wallets</p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(allowedCreatorCheckState)}
            />
          </div>
          {expandedPreSignChecks.allowedCreator && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">
                Must be listed in "Allowed market creator wallets" in General settings so this wallet is recognized by the platform.
              </p>
              <WalletAddressDisplay
                address={eoaAddress}
                isAddressCopied={isAddressCopied}
                onCopyWalletAddress={() => void copyWalletAddress()}
              />
            </div>
          )}

          {allowedCreatorCheckState === 'missing' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7"
              onClick={() => setCreatorWalletDialogOpen(true)}
              disabled={isAddingCreatorWallet || !eoaAddress}
            >
              {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-3.5 animate-spin" />}
              Add wallet
            </Button>
          )}
          {allowedCreatorCheckError && <p className="mt-2 text-sm text-destructive">{allowedCreatorCheckError}</p>}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('proposerWhitelist', proposerWhitelistHasIssue)}
              disabled={proposerWhitelistHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                proposerWhitelistHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.proposerWhitelist
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">{t('Resolution proposers whitelist')}</p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(proposerWhitelistCheckState)}
            />
          </div>
          {expandedPreSignChecks.proposerWhitelist && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {proposerWhitelistCheckState === 'missing' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => setProposersDialogOpen(true)}
                    disabled={!selectedCreatorAddress}
                  >
                    {t('Create whitelist')}
                  </Button>
                )}
                {proposerWhitelistCheckState === 'ok' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => setProposersDialogOpen(true)}
                  >
                    <UserCheckIcon className="mr-2 size-3.5" />
                    {t('Manage proposers')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => void runProposerWhitelistCheck()}
                  disabled={proposerWhitelistCheckState === 'checking' || !selectedCreatorAddress}
                >
                  {t('Re-check')}
                </Button>
              </div>
            </div>
          )}
          {proposerWhitelistCheckError && <p className="mt-2 text-sm text-destructive">{proposerWhitelistCheckError}</p>}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('slug', slugHasIssue)}
              disabled={slugHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                slugHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.slug
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">Slug available</p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(slugValidationState, 'unique')}
            />
          </div>
          {expandedPreSignChecks.slug && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">Final uniqueness check against your database.</p>
              {creationMode === 'recurring' && recurringOccurrencePreviews.length > 0
                ? (
                    <div className="space-y-1">
                      {recurringOccurrencePreviews.map((preview, index) => (
                        <p
                          key={`${preview.slug}-${index}`}
                          className="font-mono text-sm break-all text-muted-foreground"
                        >
                          {index === 0 ? 'First' : 'Next'}
                          :
                          {' '}
                          {preview.slug}
                        </p>
                      ))}
                    </div>
                  )
                : (
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {form.slug || 'Slug not generated'}
                    </p>
                  )}
            </div>
          )}
          {slugValidationState === 'duplicate' && (
            <p className="mt-2 text-sm text-destructive">
              {slugCheckError || 'Slug already exists in your database.'}
            </p>
          )}
          {slugCheckError && slugValidationState !== 'duplicate' && (
            <p className="mt-2 text-sm text-destructive">{slugCheckError}</p>
          )}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('openRouter', openRouterHasIssue)}
              disabled={openRouterHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                openRouterHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.openRouter
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">OpenRouter active</p>
            </button>
            <CheckIndicator
              state={getCheckIndicatorState(openRouterCheckState)}
            />
          </div>
          {expandedPreSignChecks.openRouter && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground">
                Required before running content AI checker.
              </p>
            </div>
          )}
          {openRouterCheckError && <p className="mt-2 text-sm text-destructive">{openRouterCheckError}</p>}
          {openRouterCheckState !== 'ok' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7"
              onClick={openAdminSettings}
            >
              <ExternalLinkIcon className="mr-2 size-3.5" />
              Open admin settings
            </Button>
          )}
        </div>

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => togglePreSignCheck('content', contentHasIssue)}
              disabled={contentHasIssue}
              className={cn(
                'flex items-center gap-2 text-left',
                contentHasIssue ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {expandedPreSignChecks.content
                ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
              <p className="text-xl font-semibold text-foreground">Content AI checker</p>
            </button>
            <CheckIndicator
              state={contentIndicatorState}
            />
          </div>
          {expandedPreSignChecks.content && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Checks language, deterministic rules, required fields, and event-date consistency.
              </p>
              {contentCheckProgressLine && (
                <p className="text-sm text-muted-foreground">{contentCheckProgressLine}</p>
              )}
              {openRouterCheckState !== 'ok' && (
                <p className="text-sm text-muted-foreground">Waiting for OpenRouter check.</p>
              )}
              {contentCheckError && (
                <p className="text-sm text-destructive">{contentCheckError}</p>
              )}

              {pendingAiIssues.length > 0 && (
                <div className="space-y-2">
                  {pendingAiIssues.map(issue => (
                    <div key={getAiIssueKey(issue)} className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                      <p className="text-sm text-red-500">
                        {issue.reason}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => goToIssueStep(issue)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => bypassIssue(issue)}
                        >
                          Ignore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {contentCheckWarnings.length > 0 && (
                <div className="space-y-2">
                  {contentCheckWarnings.map(warning => (
                    <div
                      key={`warning-${getAiIssueKey(warning)}`}
                      className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2"
                    >
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {warning.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
