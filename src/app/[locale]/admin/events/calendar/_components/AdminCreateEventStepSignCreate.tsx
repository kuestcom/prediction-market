import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import { ExternalLinkIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SignatureTxIndicator } from './admin-create-event-form-indicators'
import { getChainLabel, getExplorerTxBase } from './admin-create-event-form-utils'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

export function AdminCreateEventStepSignCreate({
  state,
}: {
  state: AdminCreateEventFormState
}) {
  const {
    authChallengeCountdownLabel,
    authChallengeRemainingSeconds,
    completedSignatureUnits,
    finalizeInProgressAccepted,
    finalizeStepHasError,
    finalizeStepIsRunning,
    finalizeStepSucceeded,
    isPreparingSignaturePlan,
    isSigningAuth,
    pendingWorkflowRequestId,
    pendingWorkflowStatus,
    preparedSignaturePlan,
    signatureFlowDone,
    signatureFlowError,
    signatureProgressPercent,
    signatureTxs,
    totalSignatureUnits,
  } = state
  const authChallengeExpired = authChallengeRemainingSeconds === 0
  const authChallengeVerified = Boolean(preparedSignaturePlan) && !authChallengeExpired
  const authChallengeStatusLabel = preparedSignaturePlan
    ? authChallengeExpired
      ? 'Expired'
      : authChallengeRemainingSeconds !== null
        ? `Verified (auth time remaining: ${authChallengeCountdownLabel})`
        : 'Verified'
    : isSigningAuth
      ? 'Awaiting wallet'
      : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
        ? 'Signed. Preparing tx plan on server'
        : signatureFlowError
          ? 'Failed'
          : 'Pending'
  const authChallengeIndicatorStatus = authChallengeVerified
    ? 'success'
    : authChallengeExpired
      ? 'error'
      : isSigningAuth
        ? 'awaiting_wallet'
        : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
          ? 'confirming'
          : signatureFlowError
            ? 'error'
            : 'idle'

  return (
    <Card className="bg-background">
      <CardHeader className="pt-8 pb-6">
        <CardTitle>Sign & create</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-8">
        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Progress</p>
              <p className="text-sm text-muted-foreground">
                {completedSignatureUnits}
                {' '}
                /
                {' '}
                {totalSignatureUnits}
                {' '}
                completed
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {signatureProgressPercent}
              %
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${signatureProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-md border px-4 py-3">
          <p className="text-base font-semibold text-foreground">Execution plan</p>
          {preparedSignaturePlan
            ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {getChainLabel()}
                    {' '}
                    ·
                    {' '}
                    {signatureTxs.length}
                    {' '}
                    txs
                    {' '}
                    ·
                    {' '}
                    {preparedSignaturePlan.creator}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    request:
                    {' '}
                    {preparedSignaturePlan.requestId}
                  </p>
                </div>
              )
            : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {pendingWorkflowRequestId
                      ? 'Server workflow is preparing your tx plan.'
                      : 'Sign auth to load tx plan.'}
                  </p>
                  {pendingWorkflowRequestId && (
                    <p className="font-mono text-xs text-muted-foreground">
                      request:
                      {' '}
                      {pendingWorkflowRequestId}
                    </p>
                  )}
                </div>
              )}
        </div>

        {signatureFlowError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-500">{signatureFlowError}</p>
          </div>
        )}

        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Sign EIP-712 auth challenge</p>
              <p className="text-xs text-muted-foreground">
                {authChallengeStatusLabel}
              </p>
              {authChallengeRemainingSeconds !== null && (
                <p className={cn(
                  'text-xs',
                  authChallengeRemainingSeconds === 0 ? 'text-destructive' : 'text-red-500',
                )}
                >
                  {authChallengeRemainingSeconds === 0
                    ? 'Auth challenge expired. Click "Sign & prepare" to issue a new one.'
                    : preparedSignaturePlan
                      ? `Auth time remaining: ${authChallengeCountdownLabel}`
                      : `Auth challenge expires in ${authChallengeCountdownLabel}`}
                </p>
              )}
            </div>
            <SignatureTxIndicator
              status={authChallengeIndicatorStatus}
            />
          </div>
        </div>

        {signatureTxs.length > 0 && (
          <div className="space-y-2">
            {signatureTxs.map((tx) => {
              const explorerBase = preparedSignaturePlan ? getExplorerTxBase() : ''
              const txHref = explorerBase && tx.hash ? `${explorerBase}${tx.hash}` : ''
              const statusLabel = tx.status === 'idle'
                ? 'Pending'
                : tx.status === 'awaiting_wallet'
                  ? 'Awaiting wallet'
                  : tx.status === 'confirming'
                    ? 'Confirming'
                    : tx.status === 'success'
                      ? 'Confirmed'
                      : 'Failed'

              return (
                <div key={tx.id} className="rounded-md border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{statusLabel}</p>
                      {tx.hash && (
                        <p className="text-xs text-muted-foreground">
                          {txHref
                            ? (
                                <a
                                  href={txHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 hover:text-foreground"
                                >
                                  {tx.hash.slice(0, 10)}
                                  ...
                                  {tx.hash.slice(-8)}
                                  <ExternalLinkIcon className="size-3" />
                                </a>
                              )
                            : (
                                <>
                                  {tx.hash.slice(0, 10)}
                                  ...
                                  {tx.hash.slice(-8)}
                                </>
                              )}
                        </p>
                      )}
                      {tx.error && <p className="text-xs text-red-500">{tx.error}</p>}
                    </div>
                    <SignatureTxIndicator status={tx.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {preparedSignaturePlan && (
          <div className="rounded-md border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Finalize and register markets</p>
                <p className="text-xs text-muted-foreground">
                  {signatureFlowDone
                    ? 'Completed'
                    : finalizeInProgressAccepted
                      ? 'Accepted by server'
                      : finalizeStepIsRunning
                        ? 'Registering markets on server'
                        : finalizeStepHasError
                          ? 'Failed'
                          : 'Pending'}
                </p>
              </div>
              <SignatureTxIndicator
                status={finalizeStepSucceeded
                  ? 'success'
                  : finalizeStepIsRunning
                    ? 'confirming'
                    : finalizeStepHasError
                      ? 'error'
                      : 'idle'}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
