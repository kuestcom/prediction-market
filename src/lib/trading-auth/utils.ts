import {
  AUTO_REDEEM_APPROVALS_VERSION,
  TOKEN_APPROVALS_VERSION,
} from '@/lib/trading-auth/approvals'

export function sanitizeTradingAuthSettings(settings: Record<string, any> | null | undefined) {
  if (!settings?.tradingAuth) {
    return settings
  }

  const { tradingAuth, ...rest } = settings
  const normalized: Record<string, any> = {}

  if (tradingAuth.relayer) {
    normalized.relayer = {
      enabled: Boolean(tradingAuth.relayer.key),
      updatedAt: tradingAuth.relayer.updatedAt,
    }
  }

  if (tradingAuth.clob) {
    normalized.clob = {
      enabled: Boolean(tradingAuth.clob.key),
      updatedAt: tradingAuth.clob.updatedAt,
    }
  }

  if (tradingAuth.approvals) {
    normalized.approvals = {
      enabled: Boolean(
        tradingAuth.approvals.completed
        && tradingAuth.approvals.version === TOKEN_APPROVALS_VERSION,
      ),
      updatedAt: tradingAuth.approvals.updatedAt,
      version: tradingAuth.approvals.version,
    }
  }

  if (tradingAuth.autoRedeem) {
    normalized.autoRedeem = {
      enabled: Boolean(
        tradingAuth.autoRedeem.completed
        && (
          !tradingAuth.autoRedeem.version
          || tradingAuth.autoRedeem.version === AUTO_REDEEM_APPROVALS_VERSION
        ),
      ),
      updatedAt: tradingAuth.autoRedeem.updatedAt,
      version: tradingAuth.autoRedeem.version,
    }
  }

  return {
    ...rest,
    tradingAuth: normalized,
  }
}
