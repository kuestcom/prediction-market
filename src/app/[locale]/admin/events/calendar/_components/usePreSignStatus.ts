import type { PreSignIndicatorState } from './admin-create-event-form-signature-helpers'
import type {
  AiValidationIssue,
  AllowedCreatorCheckState,
  ContentCheckState,
  FundingCheckState,
  NativeGasCheckState,
  OpenRouterCheckState,
  PrepareResponse,
  ProposerWhitelistCheckState,
  SignatureExecutionTx,
  SlugValidationState,
} from './admin-create-event-form-types'
import { useMemo } from 'react'
import { getAiIssueKey } from './admin-create-event-form-utils'

export function usePreSignStatus({
  allowedCreatorCheckState,
  bypassedIssueKeys,
  contentCheckError,
  contentCheckIssues,
  contentCheckState,
  fundingCheckState,
  isFinalizingSignatureFlow,
  nativeGasCheckState,
  openRouterCheckState,
  pendingWorkflowStatus,
  preparedSignaturePlan,
  proposerWhitelistCheckState,
  signatureFlowDone,
  signatureFlowError,
  signatureTxs,
  slugValidationState,
}: {
  allowedCreatorCheckState: AllowedCreatorCheckState
  bypassedIssueKeys: string[]
  contentCheckError: string
  contentCheckIssues: AiValidationIssue[]
  contentCheckState: ContentCheckState
  fundingCheckState: FundingCheckState
  isFinalizingSignatureFlow: boolean
  nativeGasCheckState: NativeGasCheckState
  openRouterCheckState: OpenRouterCheckState
  pendingWorkflowStatus: string | null
  preparedSignaturePlan: PrepareResponse | null
  proposerWhitelistCheckState: ProposerWhitelistCheckState
  signatureFlowDone: boolean
  signatureFlowError: string
  signatureTxs: SignatureExecutionTx[]
  slugValidationState: SlugValidationState
}) {
  const pendingAiIssues = useMemo(
    () => contentCheckIssues.filter(issue => !bypassedIssueKeys.includes(getAiIssueKey(issue))),
    [bypassedIssueKeys, contentCheckIssues],
  )
  const fundingHasIssue = fundingCheckState === 'insufficient' || fundingCheckState === 'no_wallet' || fundingCheckState === 'error'
  const nativeGasHasIssue = nativeGasCheckState === 'insufficient'
    || nativeGasCheckState === 'no_wallet'
    || nativeGasCheckState === 'error'
  const allowedCreatorHasIssue = allowedCreatorCheckState === 'missing'
    || allowedCreatorCheckState === 'no_wallet'
    || allowedCreatorCheckState === 'error'
  const proposerWhitelistHasIssue = proposerWhitelistCheckState === 'missing'
    || proposerWhitelistCheckState === 'no_wallet'
    || proposerWhitelistCheckState === 'error'
  const slugHasIssue = slugValidationState === 'duplicate' || slugValidationState === 'error'
  const openRouterHasIssue = openRouterCheckState === 'error'
  const contentIndicatorState = useMemo<PreSignIndicatorState>(() => {
    if (openRouterCheckState === 'error') {
      return 'error'
    }
    if (openRouterCheckState === 'checking' || contentCheckState === 'checking') {
      return 'checking'
    }
    if (openRouterCheckState === 'idle' || contentCheckState === 'idle') {
      return 'idle'
    }
    if (contentCheckError || pendingAiIssues.length > 0 || contentCheckState === 'error') {
      return 'error'
    }
    return 'ok'
  }, [contentCheckError, contentCheckState, openRouterCheckState, pendingAiIssues.length])
  const contentHasIssue = contentIndicatorState === 'error'
  const completedSignatureCount = useMemo(
    () => signatureTxs.filter(item => item.status === 'success').length,
    [signatureTxs],
  )
  const finalizeInProgressAccepted = pendingWorkflowStatus === 'finalize_in_progress'
  const finalizeStepSucceeded = signatureFlowDone
    || finalizeInProgressAccepted
    || pendingWorkflowStatus === 'finalized'
  const finalizeStepIsRunning = isFinalizingSignatureFlow || pendingWorkflowStatus === 'finalize_running'
  const finalizeStepHasError = !finalizeStepSucceeded
    && Boolean(signatureFlowError)
    && completedSignatureCount === signatureTxs.length
    && signatureTxs.length > 0
  const authPhaseCompleted = Boolean(preparedSignaturePlan)
  const totalSignatureUnits = useMemo(
    () => (preparedSignaturePlan ? signatureTxs.length + 2 : 2),
    [preparedSignaturePlan, signatureTxs.length],
  )
  const completedSignatureUnits = useMemo(
    () => {
      let completed = authPhaseCompleted ? 1 : 0
      completed += completedSignatureCount
      if (finalizeStepSucceeded) {
        completed += 1
      }
      return completed
    },
    [authPhaseCompleted, completedSignatureCount, finalizeStepSucceeded],
  )
  const signatureProgressPercent = useMemo(() => {
    if (totalSignatureUnits <= 0) {
      return 0
    }
    return Math.min(100, Math.round((completedSignatureUnits / totalSignatureUnits) * 100))
  }, [completedSignatureUnits, totalSignatureUnits])

  return {
    pendingAiIssues,
    fundingHasIssue,
    nativeGasHasIssue,
    allowedCreatorHasIssue,
    proposerWhitelistHasIssue,
    slugHasIssue,
    openRouterHasIssue,
    contentIndicatorState,
    contentHasIssue,
    completedSignatureCount,
    finalizeInProgressAccepted,
    finalizeStepSucceeded,
    finalizeStepIsRunning,
    finalizeStepHasError,
    authPhaseCompleted,
    totalSignatureUnits,
    completedSignatureUnits,
    signatureProgressPercent,
  }
}
