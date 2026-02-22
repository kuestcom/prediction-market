import type { User } from '@/types'
import { EnableTradingDialog, FundAccountDialog } from '@/app/[locale]/(platform)/_components/TradingDialogs'
import { WalletFlow } from '@/app/[locale]/(platform)/_components/WalletFlow'

interface TradingOnboardingDialogsProps {
  enableModalOpen: boolean
  onEnableOpenChange: (open: boolean) => void
  proxyStep: 'idle' | 'signing' | 'deploying' | 'completed'
  tradingAuthStep: 'idle' | 'signing' | 'completed'
  approvalsStep: 'idle' | 'signing' | 'completed'
  hasTradingAuth: boolean
  hasDeployedProxyWallet: boolean
  proxyWalletError: string | null
  tradingAuthError: string | null
  tokenApprovalError: string | null
  onProxyAction: () => void
  onTradingAuthAction: () => void
  onApprovalsAction: () => void
  fundModalOpen: boolean
  onFundOpenChange: (open: boolean) => void
  onFundDeposit: () => void
  onFundSkip: () => void
  tradeModalOpen: boolean
  onTradeOpenChange: (open: boolean) => void
  depositModalOpen: boolean
  onDepositOpenChange: (open: boolean) => void
  withdrawModalOpen: boolean
  onWithdrawOpenChange: (open: boolean) => void
  user: User | null
  meldUrl: string | null
}

export default function TradingOnboardingDialogs({
  enableModalOpen,
  onEnableOpenChange,
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
  fundModalOpen,
  onFundOpenChange,
  onFundDeposit,
  onFundSkip,
  tradeModalOpen,
  onTradeOpenChange,
  depositModalOpen,
  onDepositOpenChange,
  withdrawModalOpen,
  onWithdrawOpenChange,
  user,
  meldUrl,
}: TradingOnboardingDialogsProps) {
  return (
    <>
      <EnableTradingDialog
        open={enableModalOpen}
        onOpenChange={onEnableOpenChange}
        proxyStep={proxyStep}
        tradingAuthStep={tradingAuthStep}
        approvalsStep={approvalsStep}
        hasTradingAuth={hasTradingAuth}
        hasDeployedProxyWallet={hasDeployedProxyWallet}
        proxyWalletError={proxyWalletError}
        tradingAuthError={tradingAuthError}
        tokenApprovalError={tokenApprovalError}
        onProxyAction={onProxyAction}
        onTradingAuthAction={onTradingAuthAction}
        onApprovalsAction={onApprovalsAction}
      />

      <FundAccountDialog
        open={fundModalOpen}
        onOpenChange={onFundOpenChange}
        onDeposit={onFundDeposit}
        onSkip={onFundSkip}
      />

      <EnableTradingDialog
        open={tradeModalOpen}
        onOpenChange={onTradeOpenChange}
        proxyStep={proxyStep}
        tradingAuthStep={tradingAuthStep}
        approvalsStep={approvalsStep}
        hasTradingAuth={hasTradingAuth}
        hasDeployedProxyWallet={hasDeployedProxyWallet}
        proxyWalletError={proxyWalletError}
        tradingAuthError={tradingAuthError}
        tokenApprovalError={tokenApprovalError}
        onProxyAction={onProxyAction}
        onTradingAuthAction={onTradingAuthAction}
        onApprovalsAction={onApprovalsAction}
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
