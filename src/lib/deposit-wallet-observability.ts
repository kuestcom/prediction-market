import * as Sentry from '@sentry/nextjs'

interface DepositWalletTelemetry {
  operation: string
  userAddress?: string | null
  depositWallet?: string | null
  txHash?: string | null
  errorCode?: string | null
  durationMs?: number | null
  metadata?: string | null
  status?: number | null
}

function withDepositWalletScope(context: DepositWalletTelemetry, callback: (scope: Sentry.Scope) => void) {
  Sentry.withScope((scope) => {
    scope.setTag('deposit_wallet.operation', context.operation)
    if (context.errorCode) {
      scope.setTag('deposit_wallet.error_code', context.errorCode)
    }
    scope.setContext('deposit_wallet', {
      userAddress: context.userAddress ?? null,
      depositWallet: context.depositWallet ?? null,
      txHash: context.txHash ?? null,
      errorCode: context.errorCode ?? null,
      durationMs: context.durationMs ?? null,
      metadata: context.metadata ?? null,
      status: context.status ?? null,
    })
    callback(scope)
  })
}

export function captureDepositWalletError(error: unknown, context: DepositWalletTelemetry) {
  withDepositWalletScope(context, () => {
    Sentry.captureException(error)
  })
}

export function captureDepositWalletEvent(message: string, context: DepositWalletTelemetry) {
  withDepositWalletScope(context, () => {
    Sentry.captureMessage(message)
  })
}
