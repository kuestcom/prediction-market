import { ExternalLinkIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { useAdminCreateEventForm } from './useAdminCreateEventForm'

import { SignatureTxIndicator } from './admin-create-event-form-indicators'
import { getChainLabel, getExplorerTxBase } from './admin-create-event-form-utils'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

export function AdminCreateEventStepSignCreate({ state }: { state: AdminCreateEventFormState }) {
  const t = useExtracted()
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
      ? t('Expired')
      : authChallengeRemainingSeconds !== null
        ? t('Verified (auth time remaining: {time})', { time: authChallengeCountdownLabel })
        : t('Verified')
    : isSigningAuth
      ? t('Awaiting wallet')
      : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
        ? t('Signed. Preparing tx plan on server')
        : signatureFlowError
          ? t('Failed')
          : t('Pending')
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
        <CardTitle>{t('Sign & create')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-8">
        <div className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{t('Progress')}</p>
              <p className="text-sm text-muted-foreground">
                {completedSignatureUnits} / {totalSignatureUnits} {t('completed')}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">{signatureProgressPercent}%</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${signatureProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-md border px-4 py-3">
          <p className="text-base font-semibold text-foreground">{t('Execution plan')}</p>
          {preparedSignaturePlan ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {getChainLabel()} · {signatureTxs.length} {t('txs')} · {preparedSignaturePlan.creator}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {t('request:')} {preparedSignaturePlan.requestId}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {pendingWorkflowRequestId
                  ? t('Server workflow is preparing your tx plan.')
                  : t('Sign auth to load tx plan.')}
              </p>
              {pendingWorkflowRequestId && (
                <p className="font-mono text-xs text-muted-foreground">
                  {t('request:')} {pendingWorkflowRequestId}
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
              <p className="text-sm font-semibold text-foreground">{t('Sign EIP-712 auth challenge')}</p>
              <p className="text-xs text-muted-foreground">{authChallengeStatusLabel}</p>
              {authChallengeRemainingSeconds !== null && (
                <p className={cn('text-xs', authChallengeRemainingSeconds === 0 ? 'text-destructive' : 'text-red-500')}>
                  {authChallengeRemainingSeconds === 0
                    ? t('Auth challenge expired. Click "Sign & prepare" to issue a new one.')
                    : preparedSignaturePlan
                      ? t('Auth time remaining: {time}', { time: authChallengeCountdownLabel })
                      : t('Auth challenge expires in {time}', { time: authChallengeCountdownLabel })}
                </p>
              )}
            </div>
            <SignatureTxIndicator status={authChallengeIndicatorStatus} />
          </div>
        </div>

        {signatureTxs.length > 0 && (
          <div className="space-y-2">
            {signatureTxs.map((tx) => {
              const explorerBase = preparedSignaturePlan ? getExplorerTxBase() : ''
              const txHref = explorerBase && tx.hash ? `${explorerBase}${tx.hash}` : ''
              const statusLabel =
                tx.status === 'idle'
                  ? t('Pending')
                  : tx.status === 'awaiting_wallet'
                    ? t('Awaiting wallet')
                    : tx.status === 'confirming'
                      ? t('Confirming')
                      : tx.status === 'success'
                        ? t('Confirmed')
                        : t('Failed')

              return (
                <div key={tx.id} className="rounded-md border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{statusLabel}</p>
                      {tx.hash && (
                        <p className="text-xs text-muted-foreground">
                          {txHref ? (
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
                          ) : (
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
                <p className="text-sm font-semibold text-foreground">{t('Finalize and register markets')}</p>
                <p className="text-xs text-muted-foreground">
                  {signatureFlowDone
                    ? t('Completed')
                    : finalizeInProgressAccepted
                      ? t('Accepted by server')
                      : finalizeStepIsRunning
                        ? t('Registering markets on server')
                        : finalizeStepHasError
                          ? t('Failed')
                          : t('Pending')}
                </p>
              </div>
              <SignatureTxIndicator
                status={
                  finalizeStepSucceeded
                    ? 'success'
                    : finalizeStepIsRunning
                      ? 'confirming'
                      : finalizeStepHasError
                        ? 'error'
                        : 'idle'
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
